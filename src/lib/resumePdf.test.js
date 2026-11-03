import { describe, expect, it } from 'vitest';
import { createResumePdf } from './resumePdf.js';

const content = {
  fullName: 'Jordan Example',
  jobTitle: 'Software Engineer',
  email: 'jordan@example.com',
  phone: '555-0100',
  location: 'Toronto',
  website: 'https://example.com',
  summary: 'Software engineer focused on accessible web products.',
  skills: ['JavaScript', 'React'],
  experience: [{
    id: 'experience-1',
    title: 'Engineer',
    organization: 'Example Co',
    location: 'Remote',
    startDate: '2022',
    endDate: 'Present',
    description: 'Built accessible features.\nImproved product reliability.',
  }],
  projects: [],
  education: [],
  certifications: [],
};

describe('createResumePdf', () => {
  it.each(['modern', 'classic', 'technical', 'minimal'])('creates a valid %s PDF', async template => {
    const pdf = await createResumePdf(content, template);
    const bytes = Buffer.from(pdf.output('arraybuffer'));

    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('creates additional pages when content exceeds a page', async () => {
    const longResume = {
      ...content,
      experience: Array.from({ length: 14 }, (_, index) => ({
        ...content.experience[0],
        id: `experience-${index}`,
        title: `Engineer ${index}`,
        description: `${content.experience[0].description}\n`.repeat(10),
      })),
    };

    expect((await createResumePdf(longResume)).internal.getNumberOfPages()).toBeGreaterThan(1);
  });
});
