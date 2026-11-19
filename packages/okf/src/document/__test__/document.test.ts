import {
   isOkfConceptFile,
   isOkfStale,
   okfLastChange,
   okfTrustTier,
   OkfFormatError,
   parseOkfActor,
   parseOkfDocument,
   renderOkfIndex,
   serializeOkfDocument,
   upgradeOkfDocument,
   validateOkfDocument,
   withOkfGenerated,
   withOkfVerification,
} from '..'

const V02 = `---
type: Guide
title: Onboarding
generated: { by: process:ingest, at: 2026-06-20T22:53:05Z }
verified: { by: human:ada, at: 2026-06-25T09:00:00Z }
sources:
  - id: manual
    resource: originals/manual.pdf
    title: Manual
regions: [north, south]
---

# Onboarding

Read before the first day.[^manual]

[^manual]: Manual
`

describe('OKF documents', () => {
   it('reads a concept, a bare verified mapping as a list, and keeps unknown keys', () => {
      const document = parseOkfDocument(V02)
      expect(document.frontmatter.type).toBe('Guide')
      expect(document.frontmatter.verified).toEqual([
         { by: 'human:ada', at: '2026-06-25T09:00:00Z' },
      ])
      expect(document.frontmatter.regions).toEqual(['north', 'south'])
      expect(document.body.startsWith('\n# Onboarding')).toBe(true)
   })

   it('refuses a text without frontmatter, with broken YAML, or whose frontmatter is not a mapping', () => {
      expect(() => parseOkfDocument('# Title\n')).toThrow(OkfFormatError)
      expect(() => parseOkfDocument('---\ntype: [a\n---\n')).toThrow(
         OkfFormatError
      )
      expect(() => parseOkfDocument('---\n- a\n---\n')).toThrow(OkfFormatError)
   })

   it('writes the keys of the specification first, then the extensions in their order, and reads back the same', () => {
      const text = serializeOkfDocument({
         frontmatter: {
            zone: 'north',
            title: 'T',
            type: 'Note',
            empty: undefined,
            none: null,
            generated: { by: 'human:ada', at: '2026-01-01T00:00:00Z' },
            alpha: 1,
         },
         body: '\nBody\n',
      })
      expect(text).toBe(
         '---\ntype: Note\ntitle: T\ngenerated:\n  by: human:ada\n  at: 2026-01-01T00:00:00Z\nzone: north\nalpha: 1\n---\n\nBody\n'
      )
      const back = parseOkfDocument(text)
      expect(Object.keys(back.frontmatter)).toEqual([
         'type',
         'title',
         'generated',
         'zone',
         'alpha',
      ])
      expect(serializeOkfDocument(back)).toBe(text)
   })

   it('quotes values that YAML would read otherwise', () => {
      const text = serializeOkfDocument({
         frontmatter: {
            type: 'Note',
            title: 'Design: a primer',
            code: '0123',
            flag: 'yes',
         },
         body: '',
      })
      const back = parseOkfDocument(text).frontmatter
      expect(back.title).toBe('Design: a primer')
      expect(back.code).toBe('0123')
      expect(back.flag).toBe('yes')
   })

   it('tells concept files from reserved ones', () => {
      expect(isOkfConceptFile('guide.md')).toBe(true)
      expect(isOkfConceptFile('index.md')).toBe(false)
      expect(isOkfConceptFile('LOG.md')).toBe(false)
      expect(isOkfConceptFile('notes.txt')).toBe(false)
   })
})

describe('OKF provenance', () => {
   it('reads the three forms of actor and nothing else', () => {
      expect(parseOkfActor('human:ada')).toEqual({ kind: 'human', id: 'ada' })
      expect(parseOkfActor('process:nightly')).toEqual({
         kind: 'process',
         id: 'nightly',
      })
      expect(parseOkfActor('claude-code/claude-opus-5-5')).toEqual({
         kind: 'tool',
         id: 'claude-code/claude-opus-5-5',
      })
      expect(parseOkfActor('ada')).toBeUndefined()
      expect(parseOkfActor('human:')).toBeUndefined()
      expect(parseOkfActor(42)).toBeUndefined()
   })

   it('derives the trust tier from the verifications', () => {
      expect(okfTrustTier({})).toBe('unverified')
      expect(
         okfTrustTier({
            verified: [{ by: 'process:check', at: '2026-01-01T00:00:00Z' }],
         })
      ).toBe('machine-confirmed')
      expect(okfTrustTier(parseOkfDocument(V02).frontmatter)).toBe(
         'human-reviewed'
      )
   })

   it('tells a stale concept and the last change, with the legacy timestamp as fallback', () => {
      expect(
         isOkfStale(
            { stale_after: '2026-01-01T00:00:00Z' },
            new Date('2026-01-01T00:00:00Z')
         )
      ).toBe(true)
      expect(
         isOkfStale(
            { stale_after: '2026-01-02T00:00:00Z' },
            new Date('2026-01-01T00:00:00Z')
         )
      ).toBe(false)
      expect(isOkfStale({})).toBe(false)
      expect(
         okfLastChange({ type: 'Note', timestamp: '2025-01-01T00:00:00Z' })
      ).toBe('2025-01-01T00:00:00Z')
      expect(okfLastChange(parseOkfDocument(V02).frontmatter)).toBe(
         '2026-06-20T22:53:05Z'
      )
   })

   it('stamps the producer, dropping a legacy timestamp, and keeps one verification per actor', () => {
      const at = new Date('2026-03-04T05:06:07.890Z')
      const generated = withOkfGenerated(
         { type: 'Note', timestamp: 'old' },
         'human:ada',
         at
      )
      expect(generated).toEqual({
         type: 'Note',
         generated: { by: 'human:ada', at: '2026-03-04T05:06:07Z' },
      })

      const once = withOkfVerification(
         parseOkfDocument(V02).frontmatter,
         'process:check',
         at
      )
      const twice = withOkfVerification(once, 'human:ada', at)
      expect(twice.verified).toEqual([
         { by: 'process:check', at: '2026-03-04T05:06:07Z' },
         { by: 'human:ada', at: '2026-03-04T05:06:07Z' },
      ])
   })
})

describe('OKF validation', () => {
   it('accepts a conformant concept', () => {
      expect(validateOkfDocument(parseOkfDocument(V02))).toEqual([])
   })

   it('reports the producer-side rules of the specification', () => {
      const issues = validateOkfDocument({
         frontmatter: {
            type: ' ',
            status: 'final' as never,
            generated: { by: 'ada', at: '2026-01-01' },
            verified: [{ by: 'human:ada' } as never],
            stale_after: 'tomorrow',
            sources: [
               { id: 'a', resource: '' },
               { id: 'a', resource: 'x', author: 'nobody' },
            ],
         },
         body: '',
      })
      expect(issues.map((issue) => issue.key)).toEqual([
         'type',
         'status',
         'generated.by',
         'generated.at',
         'verified.0.at',
         'stale_after',
         'sources.0.resource',
         'sources.1.author',
         'sources.1.id',
      ])
      expect(issues.every((issue) => issue.severity === 'error')).toBe(true)
   })

   it('warns about v0.1 keys, or refuses them when the profile says so', () => {
      const legacy = parseOkfDocument(
         '---\ntype: Note\ntimestamp: 2025-01-01T00:00:00Z\n---\n\n# Citations\n\n1. A book\n'
      )
      expect(
         validateOkfDocument(legacy).map(
            (issue) => `${issue.severity} ${issue.key}`
         )
      ).toEqual(['warning timestamp', 'warning body'])
      expect(
         validateOkfDocument(legacy, { forbidLegacy: true }).every(
            (issue) => issue.severity === 'error'
         )
      ).toBe(true)
   })

   it('applies the required keys, the empty values and the rules of a profile', () => {
      const document = parseOkfDocument(
         '---\ntype: Note\ntitle: ""\nlicence: []\nrights: secret\n---\n'
      )
      const issues = validateOkfDocument(document, {
         required: ['title', 'generated'],
         forbidEmpty: true,
         rules: [
            ({ frontmatter }) =>
               ['open', 'own'].includes(frontmatter.rights as string)
                  ? []
                  : [
                       {
                          severity: 'error',
                          key: 'rights',
                          message: 'is not a known rights status',
                       },
                    ],
         ],
      })
      expect(issues.map((issue) => `${issue.key} ${issue.message}`)).toEqual([
         'title is required',
         'generated is required',
         'licence is empty: leave the key out instead',
         'rights is not a known rights status',
      ])
   })
})

describe('OKF upgrade', () => {
   it('turns a timestamp into generated, and reports a citations list', () => {
      const result = upgradeOkfDocument(
         parseOkfDocument(
            '---\ntype: Note\ntimestamp: 2025-05-06T07:08:09Z\nsoa: acme/kb\n---\n\n## Citations\n'
         ),
         { by: 'process:upgrade' }
      )
      expect(result.changed).toBe(true)
      expect(result.document.frontmatter).toEqual({
         type: 'Note',
         soa: 'acme/kb',
         generated: { by: 'process:upgrade', at: '2025-05-06T07:08:09Z' },
      })
      expect(result.remaining).toEqual([
         'the body # Citations list should move to sources',
      ])
   })

   it('keeps an existing generated, normalises a datetime without offset, and leaves a v0.2 concept alone', () => {
      const both = upgradeOkfDocument(
         {
            frontmatter: {
               type: 'Note',
               timestamp: 'x',
               generated: { by: 'human:ada' },
            },
            body: '',
         },
         { by: 'process:upgrade' }
      )
      expect(both.document.frontmatter).toEqual({
         type: 'Note',
         generated: { by: 'human:ada' },
      })
      const local = upgradeOkfDocument(
         {
            frontmatter: {
               type: 'Note',
               timestamp: '2025-05-06T07:08:09.500Z',
            },
            body: '',
         },
         { by: 'process:upgrade' }
      )
      expect(local.document.frontmatter.generated?.at).toBe(
         '2025-05-06T07:08:09.500Z'
      )
      const bad = upgradeOkfDocument(
         { frontmatter: { type: 'Note', timestamp: 'someday' }, body: '' },
         { by: 'process:upgrade' }
      )
      expect(bad.document.frontmatter.generated).toEqual({
         by: 'process:upgrade',
      })
      expect(bad.remaining).toHaveLength(1)
      const current = upgradeOkfDocument(parseOkfDocument(V02), {
         by: 'process:upgrade',
      })
      expect(current.changed).toBe(false)
      expect(current.remaining).toEqual([])
   })
})

describe('OKF index files', () => {
   it('writes sections of entries, with okf_version at the root only', () => {
      const sections = [
         {
            heading: 'Guides',
            entries: [
               {
                  title: 'First [steps]',
                  href: 'first steps.md',
                  description: 'Read\nbefore the first day.',
               },
               { title: 'Teams', href: 'teams/' },
            ],
         },
         { heading: 'Empty', entries: [] },
      ]
      expect(
         renderOkfIndex(sections, { okfVersion: true, preamble: '# Knowledge' })
      ).toBe(
         '---\nokf_version: "0.2"\n---\n\n# Knowledge\n\n# Guides\n\n* [First \\[steps\\]](first%20steps.md) - Read before the first day.\n* [Teams](teams/)\n'
      )
      expect(renderOkfIndex(sections).startsWith('# Guides\n')).toBe(true)
   })
})
