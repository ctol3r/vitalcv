import { ApiErrorBoundary, ErrorBoundary, FormErrorBoundary } from '@/components/ErrorBoundary';
import type { Meta, StoryObj } from '@storybook/react';
import { Component, useState } from 'react';

// Component that throws an error for testing
class ErrorThrowingComponent extends Component {
  constructor(props: any) {
    super(props);
    this.state = { shouldThrow: false };
  }

  render() {
    if ((this.state as any).shouldThrow) {
      throw new Error('This is a test error for Storybook');
    }

    return (
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Normal Component</h3>
        <p className="text-gray-600 mb-4">This component is working normally.</p>
        <button
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          onClick={() => this.setState({ shouldThrow: true })}
        >
          Throw Error
        </button>
      </div>
    );
  }
}

// Component that throws an API error
class ApiErrorThrowingComponent extends Component {
  constructor(props: any) {
    super(props);
    this.state = { shouldThrow: false };
  }

  render() {
    if ((this.state as any).shouldThrow) {
      throw new Error('API connection failed');
    }

    return (
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">API Component</h3>
        <p className="text-gray-600 mb-4">This component makes API calls.</p>
        <button
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          onClick={() => this.setState({ shouldThrow: true })}
        >
          Simulate API Error
        </button>
      </div>
    );
  }
}

// Component that throws a form error
class FormErrorThrowingComponent extends Component {
  constructor(props: any) {
    super(props);
    this.state = { shouldThrow: false };
  }

  render() {
    if ((this.state as any).shouldThrow) {
      throw new Error('Form validation failed');
    }

    return (
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Form Component</h3>
        <p className="text-gray-600 mb-4">This component handles form submissions.</p>
        <button
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          onClick={() => this.setState({ shouldThrow: true })}
        >
          Simulate Form Error
        </button>
      </div>
    );
  }
}

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Error boundary components for handling errors gracefully in React applications.',
      },
    },
  },
  argTypes: {
    children: {
      description: 'Child components to wrap',
      control: false,
    },
    fallback: {
      description: 'Custom fallback UI',
      control: false,
    },
    onError: {
      description: 'Error handler callback',
      action: 'error',
    },
    maxRetries: {
      description: 'Maximum number of retry attempts',
      control: { type: 'number', min: 0, max: 10 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default error boundary
export const Default: Story = {
  render: (args) => (
    <ErrorBoundary {...args}>
      <ErrorThrowingComponent />
    </ErrorBoundary>
  ),
  args: {
    maxRetries: 3,
  },
};

// Error boundary with custom fallback
export const CustomFallback: Story = {
  render: (args) => (
    <ErrorBoundary
      {...args}
      fallback={
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Custom Error UI</h3>
          <p className="text-red-600">This is a custom error fallback component.</p>
        </div>
      }
    >
      <ErrorThrowingComponent />
    </ErrorBoundary>
  ),
  args: {
    maxRetries: 3,
  },
};

// API error boundary
export const ApiError: Story = {
  render: (args) => (
    <ApiErrorBoundary {...args}>
      <ApiErrorThrowingComponent />
    </ApiErrorBoundary>
  ),
  args: {
    maxRetries: 3,
  },
};

// Form error boundary
export const FormError: Story = {
  render: (args) => (
    <FormErrorBoundary {...args}>
      <FormErrorThrowingComponent />
    </FormErrorBoundary>
  ),
  args: {
    maxRetries: 3,
  },
};

// Error boundary with no retries
export const NoRetries: Story = {
  render: (args) => (
    <ErrorBoundary {...args}>
      <ErrorThrowingComponent />
    </ErrorBoundary>
  ),
  args: {
    maxRetries: 0,
  },
};

// Error boundary with many retries
export const ManyRetries: Story = {
  render: (args) => (
    <ErrorBoundary {...args}>
      <ErrorThrowingComponent />
    </ErrorBoundary>
  ),
  args: {
    maxRetries: 10,
  },
};

// Interactive error boundary
export const Interactive: Story = {
  render: (args) => {
    const [key, setKey] = useState(0);

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => setKey((prev) => prev + 1)}
          >
            Reset Component
          </button>
        </div>
        <ErrorBoundary key={key} {...args}>
          <ErrorThrowingComponent />
        </ErrorBoundary>
      </div>
    );
  },
  args: {
    maxRetries: 3,
  },
};

// All error boundary types comparison
export const AllTypes: Story = {
  render: () => (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-lg font-semibold mb-4">Default Error Boundary</h3>
        <ErrorBoundary maxRetries={3}>
          <ErrorThrowingComponent />
        </ErrorBoundary>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">API Error Boundary</h3>
        <ApiErrorBoundary maxRetries={3}>
          <ApiErrorThrowingComponent />
        </ApiErrorBoundary>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Form Error Boundary</h3>
        <FormErrorBoundary maxRetries={3}>
          <FormErrorThrowingComponent />
        </FormErrorBoundary>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

