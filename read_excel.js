const xlsx = require('xlsx');
const fs = require('fs');

const workbook = xlsx.readFile('c:\\Users\\lenovo\\Downloads\\OPERACIONES\\BITACORA ENERO 2026.xlsx');
let output = "Sheet Names: " + workbook.SheetNames.join(", ") + "\n";

workbook.SheetNames.forEach(sheetName => {
    output += `\n--- ${sheetName} ---\n`;
    const worksheet = workbook.Sheets[sheetName];
    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    // Print first 50 rows
    data.slice(0, 50).forEach(row => {
        output += JSON.stringify(row) + "\n";
    });
});

fs.writeFileSync('excel_output.txt', output, 'utf8');
