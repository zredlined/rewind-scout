import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-6 py-24 px-8 bg-white dark:bg-black">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">FRC Scouting</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Choose where to go:</p>
        <div className="flex flex-wrap gap-3">
          <Link className="px-4 py-3 rounded-md bg-black text-white" href="/scout">Scouting Form</Link>
          <Link className="px-4 py-3 rounded-md bg-black text-white" href="/analysis">Analysis</Link>
          <Link className="px-4 py-3 rounded-md bg-black text-white" href="/form-builder">Form Builder</Link>
          <Link className="px-4 py-3 rounded-md border" href="/dashboard">TBA Imports</Link>
          <Link className="px-4 py-3 rounded-md border" href="/login">Login</Link>
        </div>
      </main>
    </div>
  );
}
