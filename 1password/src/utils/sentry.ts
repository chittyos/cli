import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Request } from 'express';

// Initialize Sentry
export const initSentry = () => {
  if (!process.env.SENTRY_DSN) {
    console.log('Sentry DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      // Enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // Enable Express.js middleware tracing
      new Sentry.Integrations.Express({
        app: true,
        router: true
      }),
      // Enable profiling
      nodeProfilingIntegration()
    ],
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
    
    // Release tracking
    release: process.env.RELEASE_VERSION,
    
    // Filter out specific errors
    beforeSend(event, hint) {
      // Filter out expected errors
      if (event.exception) {
        const error = hint.originalException;
        
        // Don't send 404 errors
        if (error && (error as any).statusCode === 404) {
          return null;
        }
        
        // Don't send validation errors
        if (error && error.message && error.message.includes('ValidationError')) {
          return null;
        }
      }
      
      // Filter sensitive data
      if (event.request) {
        // Remove auth headers
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
        
        // Remove sensitive body data
        if (event.request.data) {
          const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];
          sensitiveFields.forEach(field => {
            if (event.request.data[field]) {
              event.request.data[field] = '[FILTERED]';
            }
          });
        }
      }
      
      return event;
    },
    
    // Set user context
    initialScope: {
      tags: {
        component: 'chittychat',
        version: process.env.npm_package_version
      }
    }
  });
};

// Express error handler
export const sentryErrorHandler = Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    // Capture all errors except client errors (4xx)
    if ((error as any).status && (error as any).status >= 400 && (error as any).status < 500) {
      return false;
    }
    return true;
  }
});

// Request handler to add user context
export const sentryRequestHandler = Sentry.Handlers.requestHandler({
  user: ['id', 'email', 'username'],
  ip: true,
  request: ['method', 'url', 'query_string', 'data'],
  serverName: false,
  transaction: 'methodPath'
});

// Tracing handler
export const sentryTracingHandler = Sentry.Handlers.tracingHandler();

// Custom error capture with context
export const captureError = (error: Error, context?: any, user?: any) => {
  Sentry.withScope(scope => {
    if (context) {
      scope.setContext('additional', context);
    }
    
    if (user) {
      scope.setUser({
        id: user.id,
        email: user.email,
        username: user.username
      });
    }
    
    Sentry.captureException(error);
  });
};

// Custom message capture
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info', context?: any) => {
  Sentry.withScope(scope => {
    if (context) {
      scope.setContext('additional', context);
    }
    
    Sentry.captureMessage(message, level);
  });
};

// Performance monitoring
export const startTransaction = (name: string, op: string = 'http.server') => {
  return Sentry.startTransaction({
    name,
    op
  });
};

// Add breadcrumb for tracking user actions
export const addBreadcrumb = (message: string, category: string, data?: any) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
    timestamp: Date.now() / 1000
  });
};

// Capture user feedback
export const captureUserFeedback = (user: any, feedback: string, eventId?: string) => {
  const sentryUser: Sentry.User = {
    id: user.id,
    email: user.email,
    username: user.username
  };
  
  Sentry.captureUserFeedback({
    event_id: eventId || Sentry.lastEventId(),
    name: user.name || user.username,
    email: user.email,
    comments: feedback
  });
};

// Monitor long-running operations
export const monitorOperation = async <T>(
  operationName: string,
  operation: () => Promise<T>,
  context?: any
): Promise<T> => {
  const transaction = startTransaction(operationName, 'operation');
  
  try {
    const result = await operation();
    transaction.setStatus('ok');
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    captureError(error as Error, { operation: operationName, ...context });
    throw error;
  } finally {
    transaction.finish();
  }
};

// Express middleware for adding Sentry context
export const addSentryContext = (req: Request, res: any, next: any) => {
  // Add request ID to scope
  Sentry.configureScope(scope => {
    scope.setTag('request_id', (req as any).id);
    
    // Add user context if authenticated
    if ((req as any).user) {
      scope.setUser({
        id: (req as any).user.id,
        email: (req as any).user.email,
        username: (req as any).user.username
      });
    }
  });
  
  next();
};