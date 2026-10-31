/** Plain inputs for server rendered settings forms. `prefix` keeps ids unique when a page has many forms. */

export function Input({
  prefix,
  name,
  label,
  defaultValue,
  type = "text",
  required,
  placeholder,
}: {
  prefix: string;
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const id = `${prefix}-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} />
    </div>
  );
}

export function Area({ prefix, name, label, defaultValue }: { prefix: string; name: string; label: string; defaultValue?: string | null }) {
  const id = `${prefix}-${name}`;
  return (
    <div className="field full">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} name={name} defaultValue={defaultValue ?? ""} />
    </div>
  );
}

export function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="check">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}
