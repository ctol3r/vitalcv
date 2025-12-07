# @chai-vc/command-registry

Shared command registry for the Chai VC Platform command palette, used by both frontend and backend.

## Features

- **Single Source of Truth**: All commands defined in one place
- **Type-Safe**: Full TypeScript support with Zod validation
- **Role-Based**: Filter commands by user roles
- **Searchable**: Find commands by ID, title, or description
- **Param Validation**: Automatic parameter validation
- **Preview Functions**: Generate command previews

## Usage

### Frontend (React/Next.js)

```typescript
import { COMMANDS, findCommands, filterByRole } from '@chai-vc/command-registry';

// Get all commands
const commands = COMMANDS;

// Search commands
const results = findCommands('npi');

// Filter by role
const clinicianCommands = filterByRole(['clinician']);

// Get specific command
import { getCommand } from '@chai-vc/command-registry';
const cmd = getCommand('npi.validate');
```

### Backend (Express)

```typescript
import { validateParams, getCommand } from '@chai-vc/command-registry';

// Validate command parameters
const { valid, data, error } = validateParams('issue.vc', req.body);

if (!valid) {
  return res.status(400).json({ error });
}

// Execute command
const cmd = getCommand('issue.vc');
// ... execute command logic
```

## Adding New Commands

Edit `src/index.ts` and add to the `COMMANDS` array:

```typescript
{
  id: "my.new.command",
  title: "My Command",
  description: "Does something useful",
  usage: "/my-command <param>",
  paramsSchema: z.object({ param: z.string() }),
  rolesAllowed: ["admin"],
  preview: (p: any) => `Execute ${p.param}`,
}
```

## Building

```bash
npm run build
```

## Development

```bash
npm run dev  # Watch mode
```

