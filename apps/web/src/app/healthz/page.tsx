export default function HealthzPage(): React.ReactElement {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">EstimatePro Web Health</h1>
      <p className="text-sm text-muted-foreground">status: ok</p>
    </main>
  );
}
