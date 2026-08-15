import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PLUGIN_TEMPLATES } from "@/lib/plugin-templates";

export const Route = createFileRoute("/readme")({
  head: () => ({
    meta: [
      { title: "Readme — FINO BOT plugin guide" },
      {
        name: "description",
        content:
          "How to write, test and version FINO BOT plugins from the dashboard: context object, helpers, roles, scope and code examples.",
      },
      { property: "og:title", content: "Readme — FINO BOT plugin guide" },
      {
        property: "og:description",
        content: "Documentation for writing FINO BOT plugin scripts from the operator console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReadmePage,
});

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="panel space-y-3 p-5">
      <h2 className="font-mono text-sm uppercase tracking-widest text-primary">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-foreground">
      {children}
    </pre>
  );
}

const CTX_FIELDS: Array<[string, string]> = [
  ["ctx.args", "Teks setelah command. Contoh: /weather Bandung → \"Bandung\""],
  ["ctx.command", "Command yang memicu plugin, misal \"/weather\""],
  ["ctx.role", "Role pengirim: user | developer | moderator | admin | owner"],
  ["ctx.chatId", "ID chat Telegram (number)"],
  ["ctx.chatType", "private | group | supergroup | channel"],
  ["ctx.chatTitle", "Judul grup, null kalau chat privat"],
  ["ctx.telegramId", "ID Telegram pengirim"],
  ["ctx.from", "{ first_name, last_name, username, language_code }"],
  ["ctx.config", "Objek JSON config plugin ini (diisi dari dialog Configure)"],
  ["ctx.plugins", "Daftar semua plugin: { key, name, commands, enabled }"],
];

const HELPERS: Array<[string, string]> = [
  ["await fetchJson(url, init?)", "GET/POST JSON, otomatis parse dan lempar error kalau status bukan 2xx"],
  ["await fetchText(url, init?)", "Sama seperti fetchJson tapi mengembalikan teks mentah"],
  ["evaluate(expr)", "Evaluator ekspresi matematika aman, misal evaluate(\"12*(3+4)\")"],
  ["env(name)", "Baca secret server yang sudah terdaftar (misal API key provider)"],
  ["console.log(...)", "Output ikut tampil di panel Run test"],
];

function ReadmePage() {
  return (
    <AppShell
      title="Readme"
      description="Panduan lengkap menulis, menguji, dan mem-versi plugin FINO BOT langsung dari dashboard."
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <Section id="quickstart" title="Quick start">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Buka <strong className="text-foreground">Plugins → New plugin</strong>.
              </li>
              <li>
                Isi <strong className="text-foreground">Key</strong> (unik, huruf kecil),{" "}
                <strong className="text-foreground">Name</strong>, dan{" "}
                <strong className="text-foreground">Commands</strong> (misal <code>/weather, /w</code>).
              </li>
              <li>
                Pilih salah satu <strong className="text-foreground">Starter template</strong> di atas
                editor kode, lalu ubah sesuai kebutuhan.
              </li>
              <li>
                Klik <strong className="text-foreground">Run test</strong> dengan argumen contoh untuk
                melihat hasilnya tanpa mengirim ke Telegram.
              </li>
              <li>
                <strong className="text-foreground">Save</strong>. Setiap save membuat versi baru yang
                bisa di-rollback dari tab <strong className="text-foreground">History</strong>.
              </li>
            </ol>
          </Section>

          <Section id="anatomy" title="Anatomi plugin">
            <p>
              Kode plugin adalah body dari sebuah fungsi async. Tidak perlu menulis{" "}
              <code>function</code> atau <code>export</code> — cukup logikanya, lalu{" "}
              <code>return</code> teks balasan (format Telegram Markdown).
            </p>
            <Code>{`const name = ctx.args.trim() || ctx.from.first_name || "there";
return "Hello *" + name + "*!";`}</Code>
            <p>
              Kalau kolom kode dikosongkan, runtime akan mencari built-in handler dengan key yang sama.
              Kalau tidak ada juga, bot menjawab bahwa plugin belum punya handler.
            </p>
          </Section>

          <Section id="context" title="Objek ctx">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <tbody>
                  {CTX_FIELDS.map(([k, v]) => (
                    <tr key={k} className="border-b border-border/60">
                      <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-primary">{k}</td>
                      <td className="py-2 text-muted-foreground">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="helpers" title="Helper yang tersedia">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <tbody>
                  {HELPERS.map(([k, v]) => (
                    <tr key={k} className="border-b border-border/60">
                      <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-primary">{k}</td>
                      <td className="py-2 text-muted-foreground">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Sandbox tidak punya akses ke database atau filesystem. Untuk data eksternal gunakan
              HTTP lewat <code>fetchJson</code>, dan simpan kunci rahasia sebagai secret lalu baca
              dengan <code>env("NAMA_SECRET")</code>.
            </p>
          </Section>

          <Section id="config" title="Config, scope, dan role">
            <p>
              <strong className="text-foreground">Config</strong> adalah JSON per plugin yang dibaca
              lewat <code>ctx.config</code> — pakai untuk nilai default seperti kota, base URL, atau
              limit.
            </p>
            <p>
              <strong className="text-foreground">Scope</strong> menentukan di mana command aktif:{" "}
              <code>all</code>, <code>private</code>, atau <code>group</code>.
            </p>
            <p>
              <strong className="text-foreground">Min role</strong> ditegakkan runtime sebelum kode
              dijalankan. Untuk pengecekan lebih detail di dalam kode, baca <code>ctx.role</code>{" "}
              (lihat template Role gated).
            </p>
          </Section>

          <Section id="templates" title="Starter template">
            <p>Template ini tersedia langsung di editor kode plugin:</p>
            <ul className="space-y-2">
              {PLUGIN_TEMPLATES.map((t) => (
                <li key={t.id} className="rounded-md border border-border p-3">
                  <span className="font-mono text-xs uppercase text-primary">{t.label}</span>
                  <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="versioning" title="Versioning &amp; rollback">
            <p>
              Setiap kali kode, config, atau daftar command berubah, sistem menyimpan snapshot versi
              baru secara otomatis. Buka <strong className="text-foreground">Plugins → Configure →
              History</strong> untuk melihat semua versi, meninjau kodenya, lalu klik{" "}
              <strong className="text-foreground">Restore</strong> untuk mengembalikan versi lama.
              Rollback itu sendiri juga tercatat sebagai versi baru, jadi tidak ada riwayat yang hilang.
            </p>
          </Section>

          <Section id="example" title="Contoh lengkap: cuaca">
            <Code>{`const city = ctx.args.trim() || ctx.config.default_city || "Jakarta";

const geo = await fetchJson(
  "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(city)
);
const place = geo.results && geo.results[0];
if (!place) return "Kota *" + city + "* tidak ditemukan.";

const wx = await fetchJson(
  "https://api.open-meteo.com/v1/forecast?current_weather=true&latitude=" +
    place.latitude + "&longitude=" + place.longitude
);
const c = wx.current_weather;

return [
  "*" + place.name + ", " + (place.country || "") + "*",
  "Suhu: " + c.temperature + "°C",
  "Angin: " + c.windspeed + " km/h",
].join("\\n");`}</Code>
          </Section>

          <Section id="troubleshoot" title="Troubleshooting">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Bot diam saja</strong> — cek plugin{" "}
                <em>enabled</em>, command diawali <code>/</code>, dan webhook terpasang di Settings.
              </li>
              <li>
                <strong className="text-foreground">&quot;no runtime handler&quot;</strong> — kolom kode
                kosong dan tidak ada built-in handler dengan key tersebut.
              </li>
              <li>
                <strong className="text-foreground">Error saat Run test</strong> — pesan error dan
                durasi tampil di panel output; perbaiki lalu jalankan ulang sebelum Save.
              </li>
              <li>
                <strong className="text-foreground">Balasan berantakan</strong> — Telegram Markdown
                sensitif; escape karakter <code>_ * [ ]</code> yang bukan format.
              </li>
              <li>
                Semua eksekusi dan error tercatat di halaman <strong className="text-foreground">Logs</strong>.
              </li>
            </ul>
          </Section>
        </div>

        <nav className="panel sticky top-4 hidden h-fit space-y-2 p-4 text-sm xl:block">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">On this page</p>
          {[
            ["quickstart", "Quick start"],
            ["anatomy", "Anatomi plugin"],
            ["context", "Objek ctx"],
            ["helpers", "Helper"],
            ["config", "Config, scope, role"],
            ["templates", "Starter template"],
            ["versioning", "Versioning"],
            ["example", "Contoh lengkap"],
            ["troubleshoot", "Troubleshooting"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="block text-muted-foreground transition-colors hover:text-primary"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </AppShell>
  );
}
