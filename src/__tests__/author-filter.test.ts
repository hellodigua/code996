import { buildAuthorFilter } from '../cli/common/author-filter'
import { GitCollector } from '../git/git-collector'
import { describe, test, expect } from '@jest/globals'

describe('author-filter logic (non-repo dependent)', () => {
  const collector = new GitCollector()
  const dummyPath = process.cwd()

  test('no filtering options yields undefined pattern', async () => {
    const result = await buildAuthorFilter(collector, dummyPath, undefined, undefined, {})
    expect(result.pattern).toBeUndefined()
  })

  test('--author with unmatched keyword throws', async () => {
    await expect(
      buildAuthorFilter(collector, dummyPath, undefined, undefined, { author: 'unlikely_author_keyword_123' })
    ).rejects.toThrow(/未找到匹配作者/)
  })

  test('--exclude-authors alone returns pattern or leaves undefined (no throw)', async () => {
    const result = await buildAuthorFilter(collector, dummyPath, undefined, undefined, { excludeAuthors: 'bot' })
    expect(result).toHaveProperty('pattern')
  })
})
