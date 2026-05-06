const rules = [
  { label: 'E-Mail', token: '[EMAIL]', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { label: 'Telefon', token: '[PHONE]', regex: /\b(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}\b/g },
  { label: 'IBAN', token: '[IBAN]', regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi },
  { label: 'Kreditkarte', token: '[CARD]', regex: /\b(?:\d[ -]*?){13,19}\b/g },
  { label: 'US SSN', token: '[SSN]', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { label: 'IPv4', token: '[IP]', regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g }
];

const sample = `Name: Max Mustermann
E-Mail: max.mustermann@ainauten.com
Telefon: +49 171 1234567
IBAN: DE89370400440532013000
Kreditkarte: 4111 1111 1111 1111
US SSN: 123-45-6789
IP: 192.168.0.42
Kommentar: Bitte vertraulich behandeln.`;

const sourceEl = document.getElementById('sourceText');
const maskedEl = document.getElementById('maskedText');
const findingsEl = document.getElementById('findings');

function maskText(input) {
  let output = input;
  const findings = [];

  for (const rule of rules) {
    const matches = output.match(rule.regex);
    if (matches && matches.length) {
      findings.push({ category: rule.label, count: matches.length });
      output = output.replace(rule.regex, rule.token);
    }
  }

  return { output, findings };
}

function renderFindings(findings) {
  findingsEl.innerHTML = '';
  if (!findings.length) {
    findingsEl.innerHTML = '<li>Keine sensiblen Muster erkannt.</li>';
    return;
  }
  findings.forEach((f) => {
    const li = document.createElement('li');
    li.textContent = `${f.category}: ${f.count}`;
    findingsEl.appendChild(li);
  });
}

function runMasking() {
  const { output, findings } = maskText(sourceEl.value);
  maskedEl.value = output;
  renderFindings(findings);
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('loadExample').addEventListener('click', () => {
  sourceEl.value = sample;
  runMasking();
});

document.getElementById('maskBtn').addEventListener('click', runMasking);

document.getElementById('copyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(maskedEl.value || '');
});

document.getElementById('exportJson').addEventListener('click', () => {
  const { output, findings } = maskText(sourceEl.value);
  const payload = { createdAt: new Date().toISOString(), maskedText: output, findings };
  download('privacy-filter-export.json', JSON.stringify(payload, null, 2), 'application/json');
});

document.getElementById('exportTxt').addEventListener('click', () => {
  download('privacy-filter-export.txt', maskedEl.value || '', 'text/plain');
});
