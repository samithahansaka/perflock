# Contributing to perflock

Thank you for your interest in contributing to perflock! This document provides guidelines and information about contributing to this project.

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to build something great together.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 10.0.0

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/perflock.git
   cd perflock
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build all packages:
   ```bash
   npm run build
   ```

## Development Workflow

### Available Scripts

- `npm run build` - Build all packages
- `npm run dev` - Run in development mode with watch
- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint all packages
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking

### Project Structure

```
perflock/
├── packages/
│   ├── core/           # Main library
│   ├── cli/            # CLI tool
│   └── github-action/  # GitHub Action
├── .github/            # GitHub workflows and templates
└── ...
```

### Making Changes

1. Create a new branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Ensure tests pass:

   ```bash
   npm run test
   ```

4. Ensure linting passes:

   ```bash
   npm run lint
   ```

5. Commit your changes with a descriptive message

6. Push to your fork and create a Pull Request

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include tests for new functionality
- Update documentation as needed
- Ensure all CI checks pass
- Write clear commit messages

## Reporting Issues

When reporting issues, please include:

- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Node.js and npm versions
- Any relevant error messages or logs

## Feature Requests

Feature requests are welcome! Please open an issue with:

- A clear description of the feature
- Use cases and motivation
- Any implementation ideas (optional)

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for contributing!
