// OWNER: Art. STUB — replace. Renders rich text with {token} icons, e.g. "+2 {food} on rivers".
export function RichText(props: { text: string; className?: string }) {
  return <span className={props.className}>{props.text}</span>;
}
