import { describe, expect, it } from 'vitest'
import { FAQ, faqJsonLd } from '../components/faq'

describe('FAQ', () => {
  it('has a question and an answer in every entry', () => {
    for (const entry of FAQ) {
      expect(entry.question.trim()).not.toBe('')
      expect(entry.answer.trim()).not.toBe('')
    }
  })

  it('asks each question once', () => {
    const questions = FAQ.map((entry) => entry.question)
    expect(new Set(questions).size).toBe(questions.length)
  })

  // Answers are copied verbatim into JSON-LD, where markup is not stripped but
  // shown, and a stray tag is what turns a valid rich result into a warning.
  it('keeps answers as plain text', () => {
    for (const entry of FAQ) {
      expect(entry.answer).not.toMatch(/[<>]/)
    }
  })
})

describe('faqJsonLd', () => {
  it('emits a FAQPage carrying every entry unchanged', () => {
    const doc = JSON.parse(faqJsonLd())

    expect(doc['@context']).toBe('https://schema.org')
    expect(doc['@type']).toBe('FAQPage')
    expect(doc.mainEntity).toHaveLength(FAQ.length)

    // The structured data has to say exactly what the page says; Google reads a
    // divergence as an answer that is not on the page.
    doc.mainEntity.forEach((question: Record<string, never>, i: number) => {
      expect(question).toMatchObject({
        '@type': 'Question',
        name: FAQ[i].question,
        acceptedAnswer: { '@type': 'Answer', text: FAQ[i].answer },
      })
    })
  })
})
