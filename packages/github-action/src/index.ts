/**
 * GitHub Action for @samithahansaka/perflock
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { DefaultArtifactClient } from '@actions/artifact';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseJsonReport,
  isValidJsonReport,
  generateMarkdownReport,
  getOverallStatus,
  countByStatus,
  TestReport,
} from '@samithahansaka/perflock';

interface ActionInputs {
  testCommand: string;
  workingDirectory: string;
  baselineSource: 'artifacts' | 'branch' | 'file';
  baselineArtifact: string;
  uploadArtifacts: boolean;
  artifactName: string;
  artifactRetentionDays: number;
  commentOnPr: boolean;
  commentThreshold: 'all' | 'warn' | 'fail';
  failOnRegression: boolean;
  failOnBudgetExceeded: boolean;
  bundleStatsFile?: string;
  includeSuggestions: boolean;
  githubToken: string;
}

async function run(): Promise<void> {
  try {
    // Get inputs
    const inputs = getInputs();

    core.info('Running perflock...');
    core.info(`Test command: ${inputs.testCommand}`);

    // Change to working directory
    if (inputs.workingDirectory !== '.') {
      process.chdir(inputs.workingDirectory);
    }

    // Download baseline artifacts if using artifact-based comparison
    let _baselineReport: TestReport | undefined;
    if (inputs.baselineSource === 'artifacts') {
      _baselineReport = await downloadBaseline(inputs.baselineArtifact);
    }

    // Run performance tests
    core.startGroup('Running performance tests');
    await exec.exec(inputs.testCommand, [], {
      ignoreReturnCode: true,
    });
    core.endGroup();

    // Load results
    const resultsPath = findResultsFile();
    if (!resultsPath) {
      core.warning(
        'No results file found. Make sure tests output to .perf-contracts/results.json'
      );
      return;
    }

    const resultsContent = fs.readFileSync(resultsPath, 'utf-8');
    const report = parseJsonReport(resultsContent);

    if (!isValidJsonReport(report)) {
      throw new Error('Invalid results file format');
    }

    // Analyze results
    const status = getOverallStatus(report.results);
    const counts = countByStatus(report.results);
    const violations = report.results.filter((r) => r.status === 'fail');
    const regressions: unknown[] = []; // Would be populated from comparison

    // Generate markdown report
    const markdownReport = generateMarkdownReport(report.results, {
      includeSuggestions: inputs.includeSuggestions,
      includePassingComponents: true,
      collapseSections: true,
    });

    // Save markdown report
    const reportPath = '.perf-contracts/report.md';
    fs.writeFileSync(reportPath, markdownReport, 'utf-8');

    // Post PR comment
    if (inputs.commentOnPr && github.context.payload.pull_request) {
      const shouldComment = shouldPostComment(status, inputs.commentThreshold);
      if (shouldComment) {
        await postPrComment(markdownReport, inputs.githubToken);
      }
    }

    // Upload artifacts
    if (inputs.uploadArtifacts) {
      await uploadResultsArtifact(
        inputs.artifactName,
        resultsPath,
        inputs.artifactRetentionDays
      );
    }

    // Set outputs
    core.setOutput('status', status);
    core.setOutput('report-path', reportPath);
    core.setOutput(
      'summary',
      `${counts.pass} passed, ${counts.warn} warnings, ${counts.fail} failed`
    );
    core.setOutput('components-tested', report.results.length.toString());
    core.setOutput('budgets-exceeded', violations.length.toString());
    core.setOutput('regressions-detected', regressions.length.toString());

    // Write job summary
    await core.summary
      .addHeading('Performance Contract Results')
      .addRaw(markdownReport)
      .write();

    // Fail if needed
    if (status === 'fail') {
      if (violations.length > 0 && inputs.failOnBudgetExceeded) {
        core.setFailed(`${violations.length} performance budget(s) exceeded`);
        return;
      }
      if (regressions.length > 0 && inputs.failOnRegression) {
        core.setFailed(`${regressions.length} regression(s) detected`);
        return;
      }
    }

    core.info('Performance contract validation complete!');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

function getInputs(): ActionInputs {
  return {
    testCommand: core.getInput('test-command') || 'npm run test:perf',
    workingDirectory: core.getInput('working-directory') || '.',
    baselineSource: (core.getInput('baseline-source') || 'artifacts') as
      | 'artifacts'
      | 'branch'
      | 'file',
    baselineArtifact:
      core.getInput('baseline-artifact') || 'perf-contracts-baseline',
    uploadArtifacts: core.getBooleanInput('upload-artifacts'),
    artifactName: core.getInput('artifact-name') || 'perf-contracts-results',
    artifactRetentionDays: parseInt(
      core.getInput('artifact-retention-days') || '30',
      10
    ),
    commentOnPr: core.getBooleanInput('comment-on-pr'),
    commentThreshold: (core.getInput('comment-threshold') || 'all') as
      | 'all'
      | 'warn'
      | 'fail',
    failOnRegression: core.getBooleanInput('fail-on-regression'),
    failOnBudgetExceeded: core.getBooleanInput('fail-on-budget-exceeded'),
    bundleStatsFile: core.getInput('bundle-stats-file') || undefined,
    includeSuggestions: core.getBooleanInput('include-suggestions'),
    githubToken:
      core.getInput('github-token') || process.env.GITHUB_TOKEN || '',
  };
}

async function downloadBaseline(
  artifactName: string
): Promise<TestReport | undefined> {
  try {
    core.info(`Downloading baseline artifact: ${artifactName}`);
    const client = new DefaultArtifactClient();

    // List artifacts to find by name
    const listResult = await client.listArtifacts();
    const targetArtifact = listResult.artifacts.find(
      (a) => a.name === artifactName
    );

    if (!targetArtifact) {
      core.warning(`Baseline artifact "${artifactName}" not found`);
      return undefined;
    }

    const downloadResponse = await client.downloadArtifact(targetArtifact.id, {
      path: '.perf-contracts/baseline',
    });

    if (downloadResponse.downloadPath) {
      const baselinePath = path.join(
        downloadResponse.downloadPath,
        'results.json'
      );
      if (fs.existsSync(baselinePath)) {
        const content = fs.readFileSync(baselinePath, 'utf-8');
        return parseJsonReport(content);
      }
    }

    core.warning('Baseline artifact not found or empty');
    return undefined;
  } catch (error) {
    core.warning(`Failed to download baseline: ${error}`);
    return undefined;
  }
}

function findResultsFile(): string | null {
  const searchPaths = [
    '.perf-contracts/results.json',
    '.perf-contracts/latest.json',
    'perf-results.json',
  ];

  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      return searchPath;
    }
  }

  return null;
}

function shouldPostComment(status: string, threshold: string): boolean {
  if (threshold === 'all') return true;
  if (threshold === 'warn') return status === 'warn' || status === 'fail';
  if (threshold === 'fail') return status === 'fail';
  return false;
}

async function postPrComment(markdown: string, token: string): Promise<void> {
  if (!token) {
    core.warning('No GitHub token provided, skipping PR comment');
    return;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;
  const prNumber = github.context.payload.pull_request?.number;

  if (!prNumber) {
    core.warning('Not a PR context, skipping comment');
    return;
  }

  // Look for existing comment to update
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });

  const botComment = comments.find(
    (comment) =>
      comment.user?.type === 'Bot' &&
      comment.body?.includes('Performance Contract Report')
  );

  const commentBody = markdown;

  if (botComment) {
    // Update existing comment
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: botComment.id,
      body: commentBody,
    });
    core.info('Updated existing PR comment');
  } else {
    // Create new comment
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody,
    });
    core.info('Created new PR comment');
  }
}

async function uploadResultsArtifact(
  name: string,
  resultsPath: string,
  retentionDays: number
): Promise<void> {
  try {
    const client = new DefaultArtifactClient();

    // Ensure directory exists
    const artifactDir = path.dirname(resultsPath);
    const files = [resultsPath];

    // Also include report.md if it exists
    const reportPath = path.join(artifactDir, 'report.md');
    if (fs.existsSync(reportPath)) {
      files.push(reportPath);
    }

    await client.uploadArtifact(name, files, artifactDir, {
      retentionDays,
    });

    core.info(`Uploaded artifact: ${name}`);
  } catch (error) {
    core.warning(`Failed to upload artifact: ${error}`);
  }
}

run();
