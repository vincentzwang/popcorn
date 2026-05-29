export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { updateMissingPosters } = await import("./lib/update-posters");
    updateMissingPosters().catch((e) => console.error("[posters]", e));
  }
}
