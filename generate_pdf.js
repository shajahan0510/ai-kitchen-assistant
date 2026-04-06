const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const md = fs.readFileSync(path.join(__dirname, 'PROJECT_REPORT.md'), 'utf8');

// Simple markdown-to-HTML converter
function mdToHtml(text) {
    return text
        // Tables
        .replace(/^\|(.+)\|\s*$/gm, (m) => {
            const cells = m.split('|').filter(c => c.trim());
            const isSep = cells.every(c => /^[-: ]+$/.test(c.trim()));
            if (isSep) return '';
            return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
        })
        // Wrap table rows
        .replace(/((?:<tr>.*<\/tr>\n?)+)/g, '<table>$1</table>')
        // Headings
        .replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
        .replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
        .replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
        .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
        .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
        // Horizontal rule
        .replace(/^---$/gm, '<hr>')
        // Code blocks
        .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Ordered list
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ol>$1</ol>')
        // Unordered list
        .replace(/^\*\s+(.+)$/gm, '<li>$1</li>')
        .replace(/^-\s+(.+)$/gm, '<li>$1</li>')
        .replace(/((?:<li>.*<\/li>\n?)+)/g, s => s.includes('<ol>') ? s : '<ul>' + s + '</ul>')
        // Paragraphs
        .replace(/^(?!<[a-z]).+$/gm, p => p.trim() ? `<p>${p}</p>` : '')
        // Links
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Clean up double-wrapped
        .replace(/<p><(h[1-6]|ul|ol|li|pre|table|hr)>/g, '<$1>')
        .replace(/<\/(h[1-6]|ul|ol|li|pre|table|hr)><\/p>/g, '</$1>');
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AI Kitchen Assistant — Project Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #000;
    background: #fff;
  }
  /* Cover Page */
  .cover {
    width: 100%; height: 100vh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center;
    page-break-after: always;
    border: 3px double #000;
    padding: 40px;
  }
  .cover h1 { font-size: 22pt; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 2px; }
  .cover .subtitle { font-size: 14pt; margin-bottom: 40px; color: #444; }
  .cover .meta { font-size: 11pt; line-height: 2; margin-top: 40px; }
  .cover .logo { font-size: 64pt; margin-bottom: 20px; }
  /* Content */
  .content { padding: 20mm 25mm; }
  h1 { font-size: 18pt; margin: 24px 0 12px; border-bottom: 2px solid #000; padding-bottom: 4px; text-transform: uppercase; page-break-before: always; }
  h1:first-child, .no-break { page-break-before: avoid; }
  h2 { font-size: 14pt; margin: 20px 0 10px; border-bottom: 1px solid #aaa; padding-bottom: 2px; }
  h3 { font-size: 12pt; font-weight: bold; margin: 16px 0 8px; }
  h4 { font-size: 11pt; font-weight: bold; font-style: italic; margin: 12px 0 6px; }
  h5 { font-size: 11pt; font-weight: bold; margin: 10px 0 4px; }
  p { margin-bottom: 8px; text-align: justify; }
  ul, ol { margin: 8px 0 8px 24px; }
  li { margin-bottom: 4px; }
  code { font-family: "Courier New", monospace; font-size: 10pt; background: #f4f4f4; padding: 1px 4px; border-radius: 2px; }
  pre { background: #f4f4f4; border: 1px solid #ddd; padding: 12px; margin: 12px 0; overflow-x: hidden; font-size: 9pt; font-family: "Courier New", monospace; line-height: 1.4; white-space: pre-wrap; word-break: break-all; }
  pre code { background: none; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th, td { border: 1px solid #aaa; padding: 5px 8px; text-align: left; vertical-align: top; }
  tr:nth-child(even) td { background: #f9f9f9; }
  hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  /* TOC */
  .toc { page-break-after: always; }
  .toc h2 { text-align: center; font-size: 16pt; border: none; margin-bottom: 24px; }
  .toc ul { list-style: none; margin: 0; }
  .toc li { padding: 4px 0; border-bottom: 1px dotted #aaa; display: flex; justify-content: space-between; }
  .toc li.l1 { font-weight: bold; margin-top: 8px; }
  .toc li.l2 { padding-left: 20px; }
  .toc li.l3 { padding-left: 40px; font-size: 10pt; }
  /* Abstract */
  .abstract { page-break-after: always; }
  .abstract h2 { text-align: center; border: none; }
  .abstract p { text-align: justify; }
  /* Page numbers via counter */
  @page { size: A4; margin: 20mm 25mm; @bottom-center { content: counter(page); font-size: 10pt; } }
  @media print { body { font-size: 11pt; } }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
  <div class="logo">🍽️</div>
  <h1>AI Kitchen Assistant</h1>
  <div class="subtitle">Comprehensive Project Report</div>
  <hr style="width:60%;margin:20px auto;border-top:1px solid #000;">
  <div class="meta">
    <strong>Project Name:</strong> AI Kitchen Assistant<br>
    <strong>Technology Stack:</strong> Node.js · Express.js · Supabase · Groq AI · Imagga<br>
    <strong>Type:</strong> Full-Stack Web Application with AI Integration<br>
    <strong>Date:</strong> April 2026<br>
    <strong>Version:</strong> 1.0.0
  </div>
</div>

<!-- TABLE OF CONTENTS -->
<div class="content toc">
  <h2>TABLE OF CONTENTS</h2>
  <ul>
    <li class="l1"><span>ABSTRACT</span><span>iii</span></li>
    <li class="l1"><span>LIST OF TABLES</span><span>iv</span></li>
    <li class="l1"><span>LIST OF FIGURES</span><span>v</span></li>
    <li class="l1"><span>LIST OF ABBREVIATIONS &amp; SYMBOLS</span><span>vi</span></li>
    <li class="l1"><span>1. INTRODUCTION</span><span>1</span></li>
    <li class="l2"><span>1.1 General</span><span>1</span></li>
    <li class="l2"><span>1.2 System Analysis</span><span>2</span></li>
    <li class="l3"><span>1.2.1 General Context</span><span>2</span></li>
    <li class="l3"><span>1.2.2 Problem Statement</span><span>3</span></li>
    <li class="l3"><span>1.2.3 Objectives</span><span>4</span></li>
    <li class="l2"><span>1.3 System Architecture and Design</span><span>5</span></li>
    <li class="l2"><span>1.4 Methodology &amp; Technology Stack</span><span>6</span></li>
    <li class="l1"><span>2. LITERATURE REVIEW</span><span>8</span></li>
    <li class="l2"><span>2.1 General Review</span><span>8</span></li>
    <li class="l2"><span>2.2 AI and Computer Vision in Culinary Applications</span><span>9</span></li>
    <li class="l2"><span>2.3 The Role of Large Language Models in Recipe Generation</span><span>10</span></li>
    <li class="l1"><span>3. SYSTEM DESIGN</span><span>12</span></li>
    <li class="l2"><span>3.1 System Architecture Diagram</span><span>12</span></li>
    <li class="l2"><span>3.2 Database Design</span><span>13</span></li>
    <li class="l2"><span>3.3 API Design</span><span>18</span></li>
    <li class="l2"><span>3.4 Security Design</span><span>22</span></li>
    <li class="l1"><span>4. MODULE DESCRIPTIONS</span><span>24</span></li>
    <li class="l2"><span>4.1 Authentication Module</span><span>24</span></li>
    <li class="l2"><span>4.2 AI Recipe Suggestion Module</span><span>25</span></li>
    <li class="l2"><span>4.3 Recipe Management Module</span><span>27</span></li>
    <li class="l2"><span>4.4 Meal Planner Module</span><span>28</span></li>
    <li class="l2"><span>4.5 Grocery List Module</span><span>28</span></li>
    <li class="l2"><span>4.6 Smart Pantry Module</span><span>29</span></li>
    <li class="l2"><span>4.7 Social &amp; Community Module</span><span>29</span></li>
    <li class="l2"><span>4.8 Direct Messaging Module</span><span>30</span></li>
    <li class="l2"><span>4.9 Voice &amp; Cooking Mode Module</span><span>30</span></li>
    <li class="l2"><span>4.10 Admin Portal Module</span><span>31</span></li>
    <li class="l2"><span>4.11 Gamification Module</span><span>32</span></li>
    <li class="l1"><span>5. IMPLEMENTATION DETAILS</span><span>33</span></li>
    <li class="l2"><span>5.1 Project File Structure</span><span>33</span></li>
    <li class="l2"><span>5.2 Key Implementation Patterns</span><span>35</span></li>
    <li class="l2"><span>5.3 Deployment Configuration</span><span>36</span></li>
    <li class="l1"><span>6. TESTING AND VALIDATION</span><span>37</span></li>
    <li class="l2"><span>6.1 API Testing</span><span>37</span></li>
    <li class="l2"><span>6.2 Input Validation Testing</span><span>39</span></li>
    <li class="l2"><span>6.3 Security Testing</span><span>40</span></li>
    <li class="l2"><span>6.4 Cross-Browser &amp; Responsive Testing</span><span>41</span></li>
    <li class="l1"><span>7. RESULTS AND DISCUSSION</span><span>42</span></li>
    <li class="l2"><span>7.1 System Performance</span><span>42</span></li>
    <li class="l2"><span>7.2 AI Output Quality</span><span>43</span></li>
    <li class="l2"><span>7.3 Feature Completion Matrix</span><span>44</span></li>
    <li class="l1"><span>8. FUTURE SCOPE</span><span>46</span></li>
    <li class="l1"><span>9. CONCLUSION</span><span>48</span></li>
    <li class="l1"><span>10. REFERENCES</span><span>49</span></li>
    <li class="l1"><span>APPENDICES</span><span>51</span></li>
  </ul>
</div>

<!-- MAIN CONTENT from MD -->
<div class="content">
${mdToHtml(md.replace(/^# AI Kitchen Assistant.*\n/, '').replace(/## TABLE OF CONTENTS[\s\S]*?---/, ''))}
</div>

</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'report.html'), html, 'utf8');
console.log('HTML written. Launching Puppeteer...');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.pdf({
        path: path.join(__dirname, 'AI_Kitchen_Assistant_Project_Report.pdf'),
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '25mm', right: '25mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size:9pt;width:100%;text-align:center;color:#666;font-family:serif;">AI Kitchen Assistant — Project Report</div>',
        footerTemplate: '<div style="font-size:9pt;width:100%;text-align:center;color:#666;font-family:serif;"><span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });
    await browser.close();
    const stats = fs.statSync(path.join(__dirname, 'AI_Kitchen_Assistant_Project_Report.pdf'));
    console.log(`✅ PDF generated: AI_Kitchen_Assistant_Project_Report.pdf (${(stats.size / 1024).toFixed(1)} KB)`);
})();
