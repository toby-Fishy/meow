import { describe, expect, it } from 'vitest';
import {
  findTool,
  relatedTools,
  toolsByCategory,
  liveTools,
  validateRegistry,
  TOOLS,
  type Tool,
} from './registry.ts';

const baseTool: Tool = {
  slug: 'example-tool',
  name: 'Example Tool',
  tagline: 'Does an example thing.',
  description: 'A'.repeat(100),
  category: 'image',
  status: 'live',
  operation: 'compress',
  accepts: [],
  faqs: [{ question: 'Is this an example?', answer: 'Yes.' }],
  related: [],
};

describe('the shipped registry', () => {
  it('satisfies every invariant the site depends on', () => {
    expect(validateRegistry()).toEqual([]);
  });

  it('gives every tool a unique slug', () => {
    const slugs = TOOLS.map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('validateRegistry', () => {
  it('rejects a malformed slug', () => {
    const problems = validateRegistry([{ ...baseTool, slug: 'Not A Slug' }]);
    expect(problems).toContainEqual(expect.stringContaining('hyphen-separated'));
  });

  it('rejects duplicate slugs', () => {
    const problems = validateRegistry([baseTool, { ...baseTool, name: 'Copy' }]);
    expect(problems).toContainEqual(expect.stringContaining('duplicate slug'));
  });

  it('rejects a description that would be truncated in search results', () => {
    const problems = validateRegistry([{ ...baseTool, description: 'Too short.' }]);
    expect(problems).toContainEqual(expect.stringContaining('description is 10 characters'));
  });

  it('rejects a tool with no FAQ entries', () => {
    const problems = validateRegistry([{ ...baseTool, faqs: [] }]);
    expect(problems).toContainEqual(expect.stringContaining('at least one FAQ'));
  });

  it('rejects a dangling related-tool reference', () => {
    const problems = validateRegistry([{ ...baseTool, related: ['does-not-exist'] }]);
    expect(problems).toContainEqual(expect.stringContaining('does not exist'));
  });

  it('rejects a tool that links to itself', () => {
    const problems = validateRegistry([{ ...baseTool, related: [baseTool.slug] }]);
    expect(problems).toContainEqual(expect.stringContaining('lists itself'));
  });
});

describe('lookups', () => {
  const catalogue: Tool[] = [
    baseTool,
    { ...baseTool, slug: 'second-tool', name: 'Second', related: ['example-tool'] },
    { ...baseTool, slug: 'third-tool', name: 'Third', category: 'pdf', status: 'planned' },
  ];

  it('finds a tool by slug', () => {
    expect(findTool('second-tool', catalogue)?.name).toBe('Second');
  });

  it('returns undefined for an unknown slug', () => {
    expect(findTool('nope', catalogue)).toBeUndefined();
  });

  it('resolves related slugs to tools', () => {
    const [, second] = catalogue;
    expect(relatedTools(second!, catalogue).map((tool) => tool.slug)).toEqual(['example-tool']);
  });

  it('drops related slugs that no longer resolve', () => {
    const orphan: Tool = { ...baseTool, slug: 'orphan', related: ['gone'] };
    expect(relatedTools(orphan, catalogue)).toEqual([]);
  });

  it('filters by category', () => {
    expect(toolsByCategory('pdf', catalogue).map((tool) => tool.slug)).toEqual(['third-tool']);
  });

  it('filters out tools that are not live yet', () => {
    expect(liveTools(catalogue).map((tool) => tool.slug)).toEqual([
      'example-tool',
      'second-tool',
    ]);
  });
});
