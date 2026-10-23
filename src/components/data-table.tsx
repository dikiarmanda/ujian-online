export function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-auto rounded-xl border border-line/80 bg-paper shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-page/80 text-left text-ink-muted">
            {headers.map((header) => (
              <th key={header} className="px-3 font-semibold">
                <span className="flex h-11 items-center">{header}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line/70 last:border-0 hover:bg-brand-soft/40">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3">
                  <span className="flex min-h-11 items-center">{cell}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
