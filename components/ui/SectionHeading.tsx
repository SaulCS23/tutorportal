export default function SectionHeading({
  title,
  description,
  id,
}: {
  title: string;
  description?: string;
  id?: string;
}) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-lg font-semibold text-dark-text">
        {title}
      </h2>
      {description && (
        <p className="mt-0.5 text-sm text-muted-text">{description}</p>
      )}
    </div>
  );
}
