'use client';

import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { GraphiQL } from 'graphiql';
import 'graphiql/graphiql.css';
import React from 'react';

const fetcher = createGraphiQLFetcher({
  url: 'http://localhost:3001/graphql',
});

export default function GraphQLPage() {
  return (
    <div className="h-[calc(100vh-64px)] w-full">
      <GraphiQL fetcher={fetcher} />
    </div>
  );
}














