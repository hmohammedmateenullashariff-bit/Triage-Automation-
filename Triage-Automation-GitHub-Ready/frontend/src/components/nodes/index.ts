import { HttpRequestNode } from './HttpRequestNode';
import { ConditionalNode } from './ConditionalNode';
import { CodeNode } from './CodeNode';
import { DelayNode } from './DelayNode';
import { LlmNode } from './LlmNode';

export const nodeTypes = {
  http_request: HttpRequestNode,
  conditional: ConditionalNode,
  code: CodeNode,
  delay: DelayNode,
  llm: LlmNode,
};

export {
  HttpRequestNode,
  ConditionalNode,
  CodeNode,
  DelayNode,
  LlmNode,
};
