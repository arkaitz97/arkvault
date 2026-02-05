# ArkVault Coding Style Guide

This document outlines the coding standards and best practices for the ArkVault project. The goal is to ensure code consistency, readability, and maintainability across the codebase.

## 1. General JavaScript

### 1.1 Indentation
-   **Rule:** Use **2 spaces** for indentation.
-   **Reasoning:** Consistent with the majority of the existing codebase (`App.jsx`, `Login.jsx`, config files).
-   **Note:** `src/api.js` currently uses 4 spaces and should be updated to match.

### 1.2 Semicolons
-   **Rule:** Always use semicolons at the end of statements.
-   **Reasoning:** Prevents potential automatic semicolon insertion (ASI) issues and maintains consistency.

### 1.3 Quotes
-   **Rule:** Use **single quotes** (`'`) for string literals. Use double quotes (`"`) only when avoiding escaping single quotes within the string.
-   **Example:** `const name = 'ArkVault';`

### 1.4 Variable Declaration
-   **Rule:** Use `const` by default. Use `let` only when reassignment is necessary. Avoid `var`.

### 1.5 Naming Conventions
-   **Variables/Functions:** `camelCase` (e.g., `handleSubmit`, `userData`).
-   **Components:** `PascalCase` (e.g., `Login`, `ChangePassword`).
-   **Constants:** `UPPER_SNAKE_CASE` (e.g., `API_BASE`, `MAX_RETRIES`).
-   **Files:**
    -   React Components: `PascalCase` (e.g., `Login.jsx`).
    -   Utilities/Helpers: `camelCase` (e.g., `api.js`, `utils.js`).

## 2. React & JSX

### 2.1 Component Definition
-   **Rule:** Prefer **Arrow Functions** for components.
-   **Example:**
    ```jsx
    const MyComponent = () => {
      return <div>Hello</div>;
    };
    ```
-   **Reasoning:** Consistent with `Login.jsx` and modern practices. `App.jsx` (currently `function App()`) is an exception that can be refactored.

### 2.2 Props
-   **Rule:** Use strict equality checks (`===`).
-   **Rule:** Destructure props in the function signature or immediately inside the component.

### 2.3 Hooks
-   **Rule:** Follow the Rules of Hooks (only call at top level, only from React functions).
-   **Rule:** Use custom hooks for complex logic to keep components clean.

## 3. CSS & Styling

### 3.1 Styling Approach
-   **Rule:** **Separate CSS Files**.
-   **Description:** Do NOT use inline `<style>` blocks within JSX components.
-   **Practice:** Create a corresponding `.css` file (e.g., `Login.jsx` -> `Login.css`) and import it: `import './Login.css'`.
-   **Reasoning:** Keeps components clean and improves cacheability.

## 4. Comments & Documentation

### 4.1 Comments
-   **Rule:** **No Comments**.
-   **Reasoning:** Code should be self-documenting. If you feel the need to write a comment, refactor the code to be clearer (better variable names, smaller functions).
-   **Exceptions:** deeply complex algorithmic logic (rare) or weird browser hacks that look like bugs.

## 5. File Structure

-   **Components:** Place in `src/components/`.
-   **Pages:** Place in `src/pages/`.
-   **Context:** Place in `src/context/`.
-   **Hooks:** Place in `src/hooks/`.
-   **Utils/API:** Place in `src/` or `src/utils/`.

## 6. Tooling

### 6.1 Linting
-   The project uses **ESLint** with `eslint.config.js`.
-   **Command:** `npm run lint`

### 6.2 Formatting
-   Recommended to use **Prettier** (configuration to be added/verified) to enforce strict formatting rules automatically.
