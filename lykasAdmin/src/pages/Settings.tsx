import { useEffect, useState, type FormEvent } from "react";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader, Card } from "../components/ui/SharedUI";
import { FormField, Input } from "../components/ui/FormUI";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { LoadingState } from "../components/ui/StateDisplays";
import { useToast } from "../context/ToastContext";

interface ShelterSettings {
  address: string;
  phone: string;
  email: string;
}

export default function Settings() {
  const { showToast } = useToast();
  const [values, setValues] = useState<ShelterSettings>({ address: "", phone: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/api/settings")
      .then((res) => setValues(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.put("/api/settings", values);
      showToast("Settings saved", "success");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Shelter Settings" description="Contact details shown to adopters and used in email templates." />

      <Card className="max-w-lg">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
          <FormField label="Address" htmlFor="settings-address">
            <Input id="settings-address" value={values.address} onChange={(e) => setValues({ ...values, address: e.target.value })} />
          </FormField>
          <FormField label="Phone" htmlFor="settings-phone">
            <Input id="settings-phone" value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} />
          </FormField>
          <FormField label="Email" htmlFor="settings-email">
            <Input id="settings-email" type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />
          </FormField>
          <Button type="submit" loading={saving}>
            Save settings
          </Button>
        </form>
      </Card>
    </div>
  );
}
