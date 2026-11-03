const templates = {
  modern: '#6d4aff',
  classic: '#1f2937',
  technical: '#087e8b',
  minimal: '#475569',
};

function entriesFor(entries = []) {
  return entries.filter(entry => entry.title || entry.organization || entry.description);
}

export async function createResumePdf(content, template = 'modern') {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const maxWidth = pageWidth - margin * 2;
  const accent = templates[template] || templates.modern;
  let y = margin;
  const ensureSpace = height => {
    if (y + height > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };
  const addLine = (text, { size = 10, bold = false, color = '#334155', gap = 1.4, indent = 0 } = {}) => {
    const value = String(text || '').trim();
    if (!value) return;
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    const lines = pdf.splitTextToSize(value, maxWidth - indent);
    const height = lines.length * (size * 0.42) + gap;
    ensureSpace(height);
    pdf.text(lines, margin + indent, y);
    y += height;
  };
  const addSection = (title, items) => {
    if (!items.length) return;
    y += 3;
    ensureSpace(11);
    pdf.setDrawColor(accent);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 6;
    addLine(title.toUpperCase(), { size: 10, bold: true, color: accent, gap: 2 });
    items.forEach(entry => {
      const heading = [entry.title, [entry.startDate, entry.endDate].filter(Boolean).join(' - ')].filter(Boolean).join('  |  ');
      addLine(heading, { size: 10, bold: true, color: '#1f2937', gap: 1 });
      const organization = [entry.organization, entry.location].filter(Boolean).join(' | ');
      if (organization) addLine(organization, { size: 9, color: '#475569', gap: 1 });
      (entry.description || '').split(/\n+/).map(item => item.trim()).filter(Boolean)
        .forEach(item => addLine(`- ${item}`, { size: 9, indent: 2, gap: 1 }));
      y += 2;
    });
  };

  if (template === 'classic') {
    pdf.setTextColor(accent);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(23);
    pdf.text(content.fullName.trim(), pageWidth / 2, y + 5, { align: 'center' });
    y += 12;
  } else {
    addLine(content.fullName.trim(), { size: 23, bold: true, color: accent, gap: 2 });
  }
  if (content.jobTitle) addLine(content.jobTitle, { size: 12, bold: true, color: '#334155', gap: 2 });
  const contact = [content.email, content.phone, content.location, content.website].filter(Boolean).join('  |  ');
  if (contact) addLine(contact, { size: 8, color: '#475569', gap: 2 });
  if (content.summary.trim()) addSection('Professional summary', [{ description: content.summary }]);
  if (template === 'technical' && content.skills.length) {
    addLine('TECHNICAL SKILLS', { size: 10, bold: true, color: accent, gap: 2 });
    addLine(content.skills.filter(Boolean).join('  |  '), { size: 9, gap: 2 });
  }
  addSection('Experience', entriesFor(content.experience));
  addSection('Projects', entriesFor(content.projects));
  addSection('Education', entriesFor(content.education));
  addSection('Certifications', entriesFor(content.certifications));
  if (template !== 'technical' && content.skills.length) {
    addSection('Skills', [{ description: content.skills.filter(Boolean).join('  |  ') }]);
  }
  pdf.setProperties({ title: `${content.fullName.trim()} resume`, subject: 'Resume', author: content.fullName.trim() });
  return pdf;
}
