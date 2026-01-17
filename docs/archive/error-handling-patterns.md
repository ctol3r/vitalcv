# Error Handling Guide

## Overview

The monorepo uses a shared error handling system via `@vitalcv/shared-utils` to ensure consistent error handling across all apps.

## Error Classes

### Base Classes

**AppError** - Base class for all application errors
```typescript
import { AppError } from '@vitalcv/shared-utils';

throw new AppError('Something went wrong', 'CUSTOM_ERROR', 500);
```

### Specific Error Types

**ValidationError** (400)
```typescript
import { ValidationError } from '@vitalcv/shared-utils';

throw new ValidationError('Invalid input', { field: 'email' });
```

**AuthenticationError** (401)
```typescript
import { AuthenticationError } from '@vitalcv/shared-utils';

throw new AuthenticationError('Invalid credentials');
```

**AuthorizationError** (403)
```typescript
import { AuthorizationError } from '@vitalcv/shared-utils';

throw new AuthorizationError('Insufficient permissions');
```

**NotFoundError** (404)
```typescript
import { NotFoundError } from '@vitalcv/shared-utils';

throw new NotFoundError('User', userId);
```

**ConflictError** (409)
```typescript
import { ConflictError } from '@vitalcv/shared-utils';

throw new ConflictError('Resource already exists');
```

**RateLimitError** (429)
```typescript
import { RateLimitError } from '@vitalcv/shared-utils';

throw new RateLimitError('Too many requests', 60); // retry after 60s
```

**InternalServerError** (500)
```typescript
import { InternalServerError } from '@vitalcv/shared-utils';

throw new InternalServerError('Database connection failed');
```

**ServiceUnavailableError** (503)
```typescript
import { ServiceUnavailableError } from '@vitalcv/shared-utils';

throw new ServiceUnavailableError('PaymentService');
```

## Error Handler Utility

### Check if Error is Operational

```typescript
import { ErrorHandler } from '@vitalcv/shared-utils';

try {
  // ...
} catch (error) {
  if (ErrorHandler.isOperational(error)) {
    // Handle expected errors
  } else {
    // Handle programming errors
  }
}
```

### Convert to Safe Response

```typescript
import { ErrorHandler } from '@vitalcv/shared-utils';

try {
  // ...
} catch (error) {
  const safeError = ErrorHandler.toSafeError(error);
  // Use safeError in API response
  return res.status(safeError.statusCode).json(safeError);
}
```

### Log Errors

```typescript
import { ErrorHandler } from '@vitalcv/shared-utils';

try {
  // ...
} catch (error) {
  ErrorHandler.logError(error, { userId, requestId });
}
```

## Express Middleware Example

```typescript
import { ErrorHandler, AppError } from '@vitalcv/shared-utils';
import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  ErrorHandler.logError(error, {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  const safeError = ErrorHandler.toSafeError(error);

  res.status(safeError.statusCode).json({
    error: {
      message: safeError.message,
      code: safeError.code,
      ...(process.env.NODE_ENV === 'development' && {
        details: safeError.details,
        stack: error instanceof Error ? error.stack : undefined,
      }),
    },
  });
}
```

## Next.js API Route Example

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { ErrorHandler, NotFoundError } from '@vitalcv/shared-utils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { id } = req.query;

    if (!id) {
      throw new NotFoundError('Resource', id as string);
    }

    // ... your logic

    res.status(200).json({ data: result });
  } catch (error) {
    ErrorHandler.logError(error, { path: req.url });

    const safeError = ErrorHandler.toSafeError(error);
    res.status(safeError.statusCode).json({
      error: safeError.message,
      code: safeError.code,
    });
  }
}
```

## Best Practices

1. **Use Specific Error Types**: Prefer specific error classes over generic AppError
2. **Include Context**: Add details object for debugging
3. **Log Appropriately**: Use ErrorHandler.logError() for consistent logging
4. **Don't Expose Internals**: Use toSafeError() in production responses
5. **Handle Operational vs Programming Errors**: Differentiate between expected and unexpected errors

## Migration

### Before
```typescript
throw new Error('User not found');
```

### After
```typescript
import { NotFoundError } from '@vitalcv/shared-utils';
throw new NotFoundError('User', userId);
```

## Error Response Format

All errors follow this format:

```json
{
  "error": {
    "message": "User with identifier '123' not found",
    "code": "NOT_FOUND",
    "statusCode": 404,
    "details": {
      "resource": "User",
      "identifier": "123"
    }
  }
}
```

In production, sensitive details are omitted.

