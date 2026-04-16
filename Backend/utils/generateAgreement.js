const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, UnderlineType,
} = require('docx');
const path = require('path');
const fs   = require('fs');

/**
 * Generate a filled Employee Laptop Agreement DOCX
 * @param {object} p
 * @param {string} p.empName
 * @param {string} p.empId
 * @param {string} p.department
 * @param {string} p.position
 * @param {string} p.mobileNo
 * @param {string} p.assetId
 * @param {string} p.serial
 * @param {string} p.brand
 * @param {string} p.model
 * @param {string} p.config
 * @param {array}  p.accessories
 * @param {string} p.allocationDate   e.g. "2026-03-25"
 * @param {string} p.managerName
 * @param {string} p.managerEmail
 * @param {string} p.contactPerson
 * @param {string} p.contactEmail
 * @returns {Buffer}
 */
async function generateAgreement(p) {

  // ── Date helpers ────────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const d   = new Date(dateStr);
    const day = d.getDate();
    const sfx = ['th','st','nd','rd'][day % 10 > 3 || Math.floor(day / 10) === 1 ? 0 : day % 10] || 'th';
    return `${day}${sfx} ${d.toLocaleDateString('en-IN', { month:'long' })} ${d.getFullYear()}`;
  };

  const today     = formatDate(new Date().toISOString().split('T')[0]);
  const allocDate = formatDate(p.allocationDate);

  const deadline = new Date(p.allocationDate || Date.now());
  deadline.setDate(deadline.getDate() + 10);
  const deadlineStr = formatDate(deadline.toISOString().split('T')[0]);

  const contactPerson = p.contactPerson || 'Vasudevan D K';
  const contactEmail  = p.contactEmail  || 'Vasudevan.kannan@mindteck.com';
  const managerName   = p.managerName   || 'Manager';
  const managerEmail  = p.managerEmail  || 'manager@mindteck.com';

  // ── Logo loading ─────────────────────────────────────────────────────────────
  let logoData   = null;
  let logoType   = 'png';
  const logoPaths = [
    { file: path.join(__dirname, 'mindteck_logo.png'), type: 'png' },
    { file: path.join(__dirname, 'mindteck_logo.jpg'), type: 'jpg' },
    { file: path.join(__dirname, '..', 'public', 'mindteck_logo.png'), type: 'png' },
    { file: path.join(__dirname, '..', 'src', 'assets', 'mindteck_logo.png'), type: 'png' },
    { file: path.join(__dirname, '..', 'assets', 'mindteck_logo.png'), type: 'png' },
  ];

  for (const { file, type } of logoPaths) {
    try {
      if (fs.existsSync(file)) {
        logoData = fs.readFileSync(file);
        logoType = type;
        console.log(`Logo loaded from: ${file}`);
        break;
      }
    } catch (e) { /* try next */ }
  }

  if (!logoData) console.log('Logo not found — header will show text only.');

  // ── Border helpers ───────────────────────────────────────────────────────────
  const border    = { style: BorderStyle.SINGLE, size: 4, color: '1D5C3C' };
  const borders   = { top: border, bottom: border, left: border, right: border };
  const noBorder  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

  // ── Cell factories ───────────────────────────────────────────────────────────
  const cell = (text, bold = false, fill = 'F0F7FF', width = 4500) =>
    new TableCell({
      borders,
      width: { size: width, type: WidthType.DXA },
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        children: [new TextRun({ text, bold, font: 'Arial', size: 22 })]
      })]
    });

  const sigCell = (label, value, width = 4500) =>
    new TableCell({
      borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 4, color: '15803D' } },
      width: { size: width, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 0, right: 120 },
      children: [
        new Paragraph({ children: [new TextRun({ text: value || '', font: 'Arial', size: 22, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: label, font: 'Arial', size: 18, color: '6B7280' })] }),
      ]
    });

  // ── CHANGED: Logo row above green bar — logo left, date right ────────────────
  // This matches Image 2: Mindteck logo top-left, "Date: 29th March 2026" top-right
  const logoAboveBarRow = logoData
    ? new Table({
        width: { size: 9746, type: WidthType.DXA },
        columnWidths: [5000, 4746],
        rows: [new TableRow({ children: [

          // Left: logo only (above the green bar)
          new TableCell({
            borders: noBorders,
            width: { size: 5000, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 0, right: 0 },
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new ImageRun({
                data: logoData,
                type: logoType,
                transformation: { width: 160, height: 60 },
              })],
            })],
          }),

          // Right: Date aligned right
          new TableCell({
            borders: noBorders,
            width: { size: 4746, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 0, right: 0 },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: 'Date: ', bold: true, font: 'Arial', size: 22 }),
                new TextRun({ text: today, font: 'Arial', size: 22 }),
              ],
            })],
          }),

        ]})]
      })
    : new Table({
        width: { size: 9746, type: WidthType.DXA },
        columnWidths: [5000, 4746],
        rows: [new TableRow({ children: [
          new TableCell({
            borders: noBorders,
            width: { size: 5000, type: WidthType.DXA },
            children: [new Paragraph({
              children: [new TextRun({ text: 'MINDTECK', font: 'Arial', size: 28, bold: true })],
            })],
          }),
          new TableCell({
            borders: noBorders,
            width: { size: 4746, type: WidthType.DXA },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: 'Date: ', bold: true, font: 'Arial', size: 22 }),
                new TextRun({ text: today, font: 'Arial', size: 22 }),
              ],
            })],
          }),
        ]})]
      });

  // ── CHANGED: Green bar is now full-width text only (no logo inside) ──────────
  const greenHeaderBar = new Table({
    width: { size: 9746, type: WidthType.DXA },
    columnWidths: [9746],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: noBorders,
        width: { size: 9746, type: WidthType.DXA },
        shading: { fill: '1D5C3C', type: ShadingType.CLEAR },
        margins: { top: 200, bottom: 200, left: 280, right: 280 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'MINDTECK (INDIA) LIMITED', font: 'Arial', size: 36, bold: true, color: 'FFFFFF' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Employee Asset Agreement', font: 'Arial', size: 24, color: 'A7F3C0' })],
          }),
        ],
      }),
    ]})]
  });

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children: [

        // ── CHANGED: Logo + Date row ABOVE green bar ──────────────────────────
        logoAboveBarRow,

        new Paragraph({ children: [new TextRun('')], spacing: { after: 100 } }),

        // ── CHANGED: Full-width green bar (no logo inside) ────────────────────
        greenHeaderBar,

        new Paragraph({ children: [new TextRun('')], spacing: { after: 160 } }),

        // ── REMOVED: Standalone Date line (now shown top-right above logo bar) ─
        // ── Allocation Date stays below header as before ──────────────────────
        new Paragraph({
          children: [
            new TextRun({ text: 'Allocation Date: ', bold: true, font: 'Arial', size: 22 }),
            new TextRun({ text: allocDate, font: 'Arial', size: 22 }),
          ],
          spacing: { after: 200 },
        }),

        // ── Intro paragraph ───────────────────────────────────────────────────
        new Paragraph({
          children: [
            new TextRun({ text: 'This Agreement concerns the use of laptop computers, desktops, related equipment and accessories owned by Mindteck (India) Limited and subsidiary companies. Please read, complete and return it to ', font: 'Arial', size: 22, bold: true }),
            new TextRun({ text: 'laptop.consent@mindteck.com', font: 'Arial', size: 22, bold: true, color: '1D5C3C' }),
            new TextRun({ text: ` by the close of business on ${deadlineStr}. If you have any questions, please contact ${contactPerson} at ${contactEmail}. Thank you.`, font: 'Arial', size: 22, bold: true }),
          ],
          spacing: { after: 240 },
        }),

        // ── Reporting Manager ─────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: 'Reporting Manager', font: 'Arial', size: 24, bold: true, color: '1D5C3C' })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1D5C3C' } },
          spacing: { after: 120 },
        }),
        new Table({
          width: { size: 9746, type: WidthType.DXA },
          columnWidths: [3500, 6246],
          rows: [
            new TableRow({ children: [cell('Manager Name', true, 'DBEAFE', 3500), cell(managerName, false, 'FFFFFF', 6246)] }),
            new TableRow({ children: [cell('Manager Email', true, 'F8FAFC', 3500), cell(managerEmail, false, 'FFFFFF', 6246)] }),
          ],
        }),

        new Paragraph({ children: [new TextRun('')], spacing: { after: 200 } }),

        // ── Employee Details ──────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: 'Employee Details', font: 'Arial', size: 24, bold: true, color: '1D5C3C' })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1D5C3C' } },
          spacing: { after: 120 },
        }),
        new Table({
          width: { size: 9746, type: WidthType.DXA },
          columnWidths: [2700, 4546, 2500],
          rows: [
            new TableRow({ children: [cell('Field', true, 'DBEAFE', 2700), cell('Details', true, 'DBEAFE', 4546), cell('', true, 'DBEAFE', 2500)] }),
            new TableRow({ children: [cell('Full Name',       true,  'F8FAFC', 2700), cell(p.empName    || '', false, 'FFFFFF', 4546), cell(`ID: ${p.empId||''}`,  false, 'FFFFFF', 2500)] }),
            new TableRow({ children: [cell('Department',      true,  'F8FAFC', 2700), cell(p.department || '', false, 'FFFFFF', 4546), cell('',                    false, 'FFFFFF', 2500)] }),
            new TableRow({ children: [cell('Position / Role', true,  'F8FAFC', 2700), cell(p.position   || '', false, 'FFFFFF', 4546), cell('',                    false, 'FFFFFF', 2500)] }),
            new TableRow({ children: [cell('Mobile Number',   true,  'F8FAFC', 2700), cell(p.mobileNo   || '', false, 'FFFFFF', 4546), cell('',                    false, 'FFFFFF', 2500)] }),
          ],
        }),

        new Paragraph({ children: [new TextRun('')], spacing: { after: 200 } }),

        // ── Asset Details ─────────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: 'Asset Details', font: 'Arial', size: 24, bold: true, color: '1D5C3C' })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1D5C3C' } },
          spacing: { after: 120 },
        }),
        new Table({
          width: { size: 9746, type: WidthType.DXA },
          columnWidths: [2700, 4546, 2500],
          rows: [
            new TableRow({ children: [cell('Field', true, 'DBEAFE', 2700), cell('Details', true, 'DBEAFE', 4546), cell('', true, 'DBEAFE', 2500)] }),
            new TableRow({ children: [cell('Asset Number',  true, 'F8FAFC', 2700), cell(p.assetId || '',                          false, 'FFFFFF', 4546), cell('', false, 'FFFFFF', 2500)] }),
            new TableRow({ children: [cell('Brand / Model', true, 'F8FAFC', 2700), cell(`${p.brand||''} ${p.model||''}`.trim(),   false, 'FFFFFF', 4546), cell('', false, 'FFFFFF', 2500)] }),
            new TableRow({ children: [cell('Serial Number', true, 'F8FAFC', 2700), cell(p.serial  || '',                          false, 'FFFFFF', 4546), cell('', false, 'FFFFFF', 2500)] }),
            new TableRow({ children: [cell('Configuration', true, 'F8FAFC', 2700), cell(p.config  || '',                          false, 'FFFFFF', 4546), cell('', false, 'FFFFFF', 2500)] }),
            new TableRow({ children: [cell('Accessories',   true, 'F8FAFC', 2700), cell((p.accessories||[]).join(', ')||'None',    false, 'FFFFFF', 4546), cell('', false, 'FFFFFF', 2500)] }),
          ],
        }),

        new Paragraph({ children: [new TextRun('')], spacing: { after: 200 } }),

        // ── Policy ────────────────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: 'Policy & Guidelines', font: 'Arial', size: 24, bold: true, color: '1D5C3C' })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1D5C3C' } },
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Mindteck-owned assets (hereafter "Assets") are provided to certain employees for official business use. Every employee who receives an Asset is expected to be the only user. It must not be loaned to anyone, nor should other individuals be allowed to use it.', font: 'Arial', size: 22 })],
          spacing: { after: 160 },
        }),
        new Paragraph({ children: [new TextRun({ text: 'Protection Guidelines', bold: true, font: 'Arial', size: 22 })], spacing: { after: 80 } }),
        ...[
          'Use a surge protector, or unplug during electrical storms',
          'Keep food and drink away from the asset',
          'Position the asset on a safe surface so it does not drop or fall',
          'Do not expose to direct sunlight or extreme temperatures',
          'Do not attempt to repair a damaged or malfunctioning asset',
        ].map(txt => new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          children: [new TextRun({ text: txt, font: 'Arial', size: 22 })],
          spacing: { after: 60 },
        })),

        new Paragraph({ children: [new TextRun({ text: 'Security Guidelines', bold: true, font: 'Arial', size: 22 })], spacing: { before: 160, after: 80 } }),
        ...[
          'Secure your asset in a safe place at the end of the day',
          'Do not leave the asset in an unlocked vehicle',
          'Immediately notify SAT at sysadmin@mindteck.com if lost or stolen',
        ].map(txt => new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          children: [new TextRun({ text: txt, font: 'Arial', size: 22 })],
          spacing: { after: 60 },
        })),

        new Paragraph({ children: [new TextRun('')], spacing: { after: 160 } }),

        // ── Acceptance ────────────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: 'Laptop Acceptance', font: 'Arial', size: 24, bold: true, color: '1D5C3C', underline: { type: UnderlineType.SINGLE } })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1D5C3C' } },
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'I agree to the terms outlined in this Agreement, and accept these responsibilities as a Mindteck asset user:', bold: true, font: 'Arial', size: 22 })],
          spacing: { after: 100 },
        }),
        ...[
          'I will follow the care guidelines listed above.',
          'I will use the asset for Mindteck or professional development purposes only.',
          'I will not install any software without approval by my Manager and the SAT.',
          'I will not write on or place any labels or stickers on the asset.',
          'I will not disable or uninstall virus protection or any other program provided with the asset.',
          'I will report any problems/issues to the SAT immediately.',
          'I will ensure any documents I create will be backed up to the network regularly.',
        ].map(txt => new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          children: [new TextRun({ text: txt, font: 'Arial', size: 22 })],
          spacing: { after: 60 },
        })),

        new Paragraph({ children: [new TextRun('')], spacing: { after: 200 } }),

        // ── Signatures ────────────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: 'Employee Acknowledgement', font: 'Arial', size: 24, bold: true, color: '1D5C3C' })],
          spacing: { after: 200 },
        }),
        new Table({
          width: { size: 9746, type: WidthType.DXA },
          columnWidths: [3200, 400, 3200, 400, 2546],
          rows: [new TableRow({ children: [
            sigCell('Full Name',     p.empName  || '', 3200),
            new TableCell({ borders: noBorders, width: { size: 400, type: WidthType.DXA }, children: [new Paragraph('')] }),
            sigCell('Position',      p.position || '', 3200),
            new TableCell({ borders: noBorders, width: { size: 400, type: WidthType.DXA }, children: [new Paragraph('')] }),
            sigCell('Mobile Number', p.mobileNo || '', 2546),
          ]})]
        }),

        new Paragraph({ children: [new TextRun('')], spacing: { after: 400 } }),

        new Table({
          width: { size: 9746, type: WidthType.DXA },
          columnWidths: [5000, 400, 4346],
          rows: [new TableRow({ children: [
            sigCell('Signature', '', 5000),
            new TableCell({ borders: noBorders, width: { size: 400, type: WidthType.DXA }, children: [new Paragraph('')] }),
            sigCell('Date', allocDate, 4346),
          ]})]
        }),

        new Paragraph({ children: [new TextRun('')], spacing: { after: 300 } }),

        // ── Footer notice ─────────────────────────────────────────────────────
        new Table({
          width: { size: 9746, type: WidthType.DXA },
          columnWidths: [9746],
          rows: [new TableRow({ children: [new TableCell({
            borders,
            width: { size: 9746, type: WidthType.DXA },
            shading: { fill: 'FFF7ED', type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Please send your completed form to ', font: 'Arial', size: 22, bold: true }),
                  new TextRun({ text: 'laptop.consent@mindteck.com',          font: 'Arial', size: 22, bold: true, color: '1D5C3C' }),
                  new TextRun({ text: ` by the close of business on ${deadlineStr}.`, font: 'Arial', size: 22, bold: true }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `If we do not receive your consent on or before ${deadlineStr} (10 days from allocation date), the laptop agreement is deemed as accepted.`, font: 'Arial', size: 20, color: '6B7280' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `For any queries, please contact ${contactPerson} at ${contactEmail}`, font: 'Arial', size: 20, color: '1D5C3C' })],
              }),
            ],
          })]})],
        }),

      ],
    }],
  });

  return await Packer.toBuffer(doc);
}

module.exports = { generateAgreement };