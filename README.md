# @selorax/cli

The official SeloraX developer CLI for building, testing, and deploying extensions on the SeloraX platform.

## Installation

```bash
npm install -g @selorax/cli
```

## Quick Start

```bash
# Authenticate with SeloraX
selorax auth:login

# Generate a new extension
selorax generate:extension

# Generate project config
selorax generate:config

# Start dev server with hot reload
selorax app:dev

# Build extensions
selorax extension:build

# Validate extensions
selorax extension:validate

# Deploy to production
selorax app:deploy
```

## Commands

### Authentication

| Command | Description |
|---------|-------------|
| `selorax auth:login` | Authenticate with your SeloraX app credentials |
| `selorax auth:logout` | Clear stored credentials |
| `selorax auth:status` | Show current authentication status |

### App Management

| Command | Description |
|---------|-------------|
| `selorax app:info` | Show local and remote app configuration |
| `selorax app:dev` | Start development server with live reload |
| `selorax app:deploy` | Build and deploy extensions to SeloraX |
| `selorax app:versions` | List deployed extension versions |
| `selorax app:rollback` | Rollback to a previous version |

### Extensions

| Command | Description |
|---------|-------------|
| `selorax extension:build` | Build extension source files |
| `selorax extension:validate` | Validate extension configuration |

### Generators

| Command | Description |
|---------|-------------|
| `selorax generate:extension` | Scaffold a new extension |
| `selorax generate:config` | Generate `selorax.config.json` |

## Extension Targets

Extensions can render in these dashboard locations:

- `order.detail.block` / `order.detail.action` / `order.detail.print-action`
- `order.list.action` / `order.list.selection-action`
- `product.detail.block` / `product.detail.action` / `product.detail.print-action`
- `product.list.action` / `product.list.selection-action`
- `customer.detail.block` / `customer.detail.action`
- `customer.list.action` / `customer.list.selection-action`
- `dashboard.widget` / `dashboard.block`
- `navigation.link` / `settings.page` / `global.action`
- `pos.action` / `pos.cart.block`
- `checkout.block` / `checkout.action`
- `fulfillment.detail.block` / `fulfillment.detail.action`

## Extension Modes

- **JSON mode** — Declarative UI trees using `@selorax/ui` components
- **Sandbox mode** — Full JavaScript extensions running in an isolated iframe

## Configuration

Create a `selorax.config.json` in your project root:

```json
{
  "app_id": "your-app-id",
  "extensions": [
    {
      "id": "my-extension",
      "name": "My Extension",
      "target": "order.detail.block",
      "mode": "json",
      "ui": { "type": "Card", "children": [] }
    }
  ]
}
```

## Deploy Options

```bash
selorax app:deploy              # Full deploy
selorax app:deploy --dry-run    # Preview without deploying
selorax app:deploy --force      # Skip confirmation
```

## Requirements

- Node.js >= 18.0.0
- A SeloraX app with Client ID and Client Secret

## License

MIT - SeloraX
