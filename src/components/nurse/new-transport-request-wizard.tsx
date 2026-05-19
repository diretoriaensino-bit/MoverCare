"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";

type Sector = {
  id: string;
  name: string;
  floor: string | null;
  qr_code: string | null;
  active: boolean;
};

type FormAction = (formData: FormData) => void | Promise<void>;

type WizardProps = {
  sectors: Sector[];
  action: FormAction;
  initialOpen?: boolean;
};

type FormState = {
  patient_code: string;
  bed_number: string;
  origin_sector_id: string;
  destination_sector_id: string;
  transport_reason: string;
  priority: string;
  risk_classification: string;
  precaution_type: string;
  required_team: string[];
  required_equipment: string[];
  invasive_devices: string[];
  continuous_medications: string[];
  documents_required: string[];
  destination_contact_confirmed: boolean;
  clinical_observations: string;
  notes: string;
};

type ArrayField =
  | "required_team"
  | "required_equipment"
  | "invasive_devices"
  | "continuous_medications"
  | "documents_required";

type Option = {
  value: string;
  label: string;
  description?: string;
};

const steps = [
  "Paciente e trajeto",
  "Motivo e risco",
  "Equipe e precaução",
  "Equipamentos",
  "Documentos e observações",
  "Revisão"
];

const transportReasonOptions: Option[] = [
  { value: "exam", label: "Realização de exame" },
  { value: "procedure", label: "Procedimento terapêutico" },
  { value: "surgery", label: "Procedimento cirúrgico" },
  { value: "bed_transfer", label: "Transferência de leito" },
  { value: "interclinic_transfer", label: "Transferência interclínica" },
  { value: "hospital_discharge", label: "Alta hospitalar" },
  { value: "external_activity", label: "Atividade externa" },
  { value: "other", label: "Outro" }
];

const riskOptions: Option[] = [
  {
    value: "low",
    label: "Baixo risco",
    description: "Paciente estável, sem necessidade de suporte avançado."
  },
  {
    value: "medium",
    label: "Médio risco",
    description: "Pode exigir monitorização, oxigênio ou acompanhamento maior."
  },
  {
    value: "high",
    label: "Alto risco",
    description: "Exige maior suporte, equipe ampliada e equipamentos críticos."
  }
];

const precautionOptions: Option[] = [
  { value: "standard", label: "Padrão" },
  { value: "contact", label: "Contato" },
  { value: "droplet", label: "Gotículas" },
  { value: "aerosol", label: "Aerossóis / respiratório" },
  { value: "reverse", label: "Reverso" }
];

const teamOptions: Option[] = [
  { value: "nursing_technician", label: "Técnico de enfermagem" },
  { value: "nurse", label: "Enfermeiro" },
  { value: "physician", label: "Médico" },
  {
    value: "physiotherapist",
    label: "Fisioterapeuta",
    description: "Recomendado quando houver suporte ventilatório."
  },
  { value: "stretcher_bearer", label: "Maqueiro" },
  { value: "cleaning_team", label: "Higienização / limpeza" },
  { value: "destination_team", label: "Equipe do setor de destino" }
];

const equipmentOptions: Option[] = [
  { value: "wheelchair", label: "Cadeira de rodas" },
  { value: "stretcher", label: "Maca" },
  { value: "oxygen", label: "Oxigênio" },
  { value: "oxygen_cylinder", label: "Cilindro de oxigênio cheio" },
  { value: "monitor", label: "Monitor cardíaco / multiparamétrico" },
  { value: "pulse_oximeter", label: "Oxímetro de pulso" },
  { value: "infusion_pump", label: "Bomba de infusão contínua" },
  { value: "transport_ventilator", label: "Ventilador de transporte" },
  { value: "transport_kit", label: "Maleta / kit de transporte" },
  { value: "suction", label: "Aspirador / sonda de aspiração" },
  { value: "ppe", label: "EPIs conforme precaução" },
  { value: "isolation", label: "Isolamento" },
  { value: "other", label: "Outros" }
];

const deviceOptions: Option[] = [
  { value: "sng", label: "SNG" },
  { value: "sne", label: "SNE" },
  { value: "svd", label: "SVD" },
  { value: "dpt", label: "DPT" },
  { value: "tot_tqt", label: "TOT / TQT" },
  { value: "khr", label: "KHR" },
  { value: "drain", label: "Dreno" },
  { value: "dve", label: "DVE" },
  { value: "pai", label: "PAI" },
  { value: "central_venous_access", label: "Acesso venoso central" },
  { value: "peripheral_venous_access", label: "Acesso venoso periférico" },
  { value: "dialysis_catheter", label: "Cateter para diálise" },
  { value: "other", label: "Outro" }
];

const medicationOptions: Option[] = [
  { value: "vasoactive_drug", label: "Droga vasoativa" },
  { value: "sedation", label: "Sedação contínua" },
  { value: "insulin", label: "Insulina contínua" },
  { value: "antibiotic", label: "Antibiótico em infusão" },
  { value: "other", label: "Outra infusão contínua" }
];

const documentOptions: Option[] = [
  { value: "medical_record", label: "Prontuário" },
  { value: "daily_prescription", label: "Prescrição do dia" },
  { value: "laboratory_tests", label: "Exames laboratoriais" },
  { value: "ct_scan", label: "Tomografia / TC" },
  { value: "surgical_description", label: "Descrição cirúrgica" },
  { value: "identification_bracelet", label: "Pulseira de identificação" },
  { value: "other", label: "Outro" }
];

const initialFormState: FormState = {
  patient_code: "",
  bed_number: "",
  origin_sector_id: "",
  destination_sector_id: "",
  transport_reason: "",
  priority: "normal",
  risk_classification: "",
  precaution_type: "standard",
  required_team: [],
  required_equipment: [],
  invasive_devices: [],
  continuous_medications: [],
  documents_required: [],
  destination_contact_confirmed: false,
  clinical_observations: "",
  notes: ""
};

const fieldClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15";

function getOptionLabel(options: Option[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function getSectorLabel(sectors: Sector[], value: string) {
  const sector = sectors.find((item) => item.id === value);

  if (!sector) {
    return "Não informado";
  }

  return `${sector.name}${sector.floor ? ` - ${sector.floor}` : ""}`;
}

function uniqueMerge(current: string[], values: string[]) {
  return Array.from(new Set([...current, ...values]));
}

function StepIndicator({
  index,
  currentStep
}: {
  index: number;
  currentStep: number;
}) {
  const active = index === currentStep;
  const done = index < currentStep;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
          active
            ? "bg-[#f2b709] text-slate-950"
            : done
              ? "bg-[#009da8] text-white"
              : "bg-slate-100 text-slate-500"
        }`}
      >
        {done ? "✓" : index + 1}
      </div>

      <span
        className={`hidden text-xs font-black lg:inline ${
          active ? "text-slate-950" : "text-slate-500"
        }`}
      >
        {steps[index]}
      </span>
    </div>
  );
}

function SummaryList({
  title,
  values,
  options
}: {
  title: string;
  values: string[];
  options: Option[];
}) {
  return (
    <div className="rounded-2xl border border-[#009da8]/20 bg-white p-4">
      <h4 className="font-black text-slate-900">{title}</h4>

      {values.length === 0 ? (
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Nenhum item selecionado.
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-600">
          {values.map((value) => (
            <li key={value}>• {getOptionLabel(options, value)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InfoBox({
  children,
  tone = "primary"
}: {
  children: ReactNode;
  tone?: "primary" | "gold" | "danger" | "success";
}) {
  const className = {
    primary: "border-[#009da8]/25 bg-[#009da8]/10 text-[#007983]",
    gold: "border-[#f2b709]/50 bg-[#f2b709]/15 text-slate-800",
    danger: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700"
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${className}`}>
      {children}
    </div>
  );
}

export function NewTransportRequestWizard({
  sectors,
  action,
  initialOpen = false
}: WizardProps) {
  const [open, setOpen] = useState(initialOpen);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(initialFormState);

  const progress = useMemo(() => {
    return Math.round(((currentStep + 1) / steps.length) * 100);
  }, [currentStep]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function toggleArray(field: ArrayField, value: string) {
    setForm((current) => {
      const currentValues = current[field];
      const exists = currentValues.includes(value);

      return {
        ...current,
        [field]: exists
          ? currentValues.filter((item) => item !== value)
          : [...currentValues, value]
      };
    });
  }

  function applyRiskDefaults(risk: string) {
    setForm((current) => {
      if (risk === "low") {
        return {
          ...current,
          risk_classification: risk,
          required_team: uniqueMerge(current.required_team, [
            "stretcher_bearer",
            "nursing_technician"
          ]),
          required_equipment: uniqueMerge(current.required_equipment, [
            "wheelchair",
            "stretcher"
          ])
        };
      }

      if (risk === "medium") {
        return {
          ...current,
          risk_classification: risk,
          required_team: uniqueMerge(current.required_team, [
            "stretcher_bearer",
            "nursing_technician",
            "nurse"
          ]),
          required_equipment: uniqueMerge(current.required_equipment, [
            "stretcher",
            "oxygen",
            "pulse_oximeter"
          ])
        };
      }

      if (risk === "high") {
        return {
          ...current,
          risk_classification: risk,
          required_team: uniqueMerge(current.required_team, [
            "stretcher_bearer",
            "nursing_technician",
            "nurse",
            "physician",
            "physiotherapist"
          ]),
          required_equipment: uniqueMerge(current.required_equipment, [
            "stretcher",
            "oxygen",
            "oxygen_cylinder",
            "monitor",
            "pulse_oximeter",
            "infusion_pump",
            "transport_kit"
          ])
        };
      }

      return {
        ...current,
        risk_classification: risk
      };
    });
  }

  function handlePrecautionChange(value: string) {
    setForm((current) => {
      if (value === "standard") {
        return {
          ...current,
          precaution_type: value
        };
      }

      return {
        ...current,
        precaution_type: value,
        required_equipment: uniqueMerge(current.required_equipment, [
          "ppe",
          "isolation"
        ])
      };
    });
  }

  function validateStep(step: number) {
    if (step === 0) {
      if (!form.patient_code.trim()) {
        return "Informe o código do paciente.";
      }

      if (!form.origin_sector_id) {
        return "Selecione o setor de origem.";
      }

      if (!form.destination_sector_id) {
        return "Selecione o setor de destino.";
      }

      if (form.origin_sector_id === form.destination_sector_id) {
        return "Origem e destino não podem ser iguais.";
      }
    }

    if (step === 1) {
      if (!form.transport_reason) {
        return "Selecione o motivo do transporte.";
      }

      if (!form.risk_classification) {
        return "Selecione a classificação de risco.";
      }
    }

    if (step === 2) {
      if (!form.precaution_type) {
        return "Selecione o tipo de precaução.";
      }

      if (form.required_team.length === 0) {
        return "Selecione pelo menos uma equipe necessária.";
      }
    }

    if (step === 3) {
      if (form.required_equipment.length === 0) {
        return "Selecione pelo menos um equipamento obrigatório.";
      }
    }

    if (step === 4) {
      if (!form.destination_contact_confirmed) {
        return "Confirme que o setor de destino foi avisado ou está ciente.";
      }
    }

    return "";
  }

  function goNext() {
    const validationError = validateStep(currentStep);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  }

  function goBack() {
    setError("");
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    for (let step = 0; step < steps.length - 1; step += 1) {
      const validationError = validateStep(step);

      if (validationError) {
        event.preventDefault();
        setCurrentStep(step);
        setError(validationError);
        return;
      }
    }
  }

  function renderHiddenFields() {
    return (
      <>
        <input type="hidden" name="patient_code" value={form.patient_code} />
        <input type="hidden" name="bed_number" value={form.bed_number} />
        <input
          type="hidden"
          name="origin_sector_id"
          value={form.origin_sector_id}
        />
        <input
          type="hidden"
          name="destination_sector_id"
          value={form.destination_sector_id}
        />
        <input
          type="hidden"
          name="transport_reason"
          value={form.transport_reason}
        />
        <input type="hidden" name="priority" value={form.priority} />
        <input
          type="hidden"
          name="risk_classification"
          value={form.risk_classification}
        />
        <input
          type="hidden"
          name="precaution_type"
          value={form.precaution_type}
        />
        <input
          type="hidden"
          name="clinical_observations"
          value={form.clinical_observations}
        />
        <input type="hidden" name="notes" value={form.notes} />

        {form.destination_contact_confirmed ? (
          <input
            type="hidden"
            name="destination_contact_confirmed"
            value="true"
          />
        ) : null}

        {form.required_team.map((item) => (
          <input
            key={`team-${item}`}
            type="hidden"
            name="required_team"
            value={item}
          />
        ))}

        {form.required_equipment.map((item) => (
          <input
            key={`equipment-${item}`}
            type="hidden"
            name="required_equipment"
            value={item}
          />
        ))}

        {form.invasive_devices.map((item) => (
          <input
            key={`device-${item}`}
            type="hidden"
            name="invasive_devices"
            value={item}
          />
        ))}

        {form.continuous_medications.map((item) => (
          <input
            key={`medication-${item}`}
            type="hidden"
            name="continuous_medications"
            value={item}
          />
        ))}

        {form.documents_required.map((item) => (
          <input
            key={`document-${item}`}
            type="hidden"
            name="documents_required"
            value={item}
          />
        ))}
      </>
    );
  }

  function OptionCard({
    field,
    option
  }: {
    field: ArrayField;
    option: Option;
  }) {
    const selected = form[field].includes(option.value);

    return (
      <button
        type="button"
        onClick={() => toggleArray(field, option.value)}
        className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
          selected
            ? "border-[#009da8] bg-[#009da8]/10 text-[#007983] ring-2 ring-[#009da8]/15"
            : "border-slate-200 bg-white text-slate-700 hover:border-[#009da8]/40 hover:bg-[#009da8]/5"
        }`}
      >
        <span className="block font-black">{option.label}</span>

        {option.description ? (
          <span className="mt-1 block text-xs font-semibold text-slate-500">
            {option.description}
          </span>
        ) : null}
      </button>
    );
  }

  function SingleChoiceCard({
    selected,
    onClick,
    title,
    description,
    tone = "primary"
  }: {
    selected: boolean;
    onClick: () => void;
    title: string;
    description?: string;
    tone?: "primary" | "gold" | "danger";
  }) {
    const selectedClass = {
      primary: "border-[#009da8] bg-[#009da8]/10 text-[#007983] ring-2 ring-[#009da8]/15",
      gold: "border-[#f2b709] bg-[#f2b709]/15 text-slate-900 ring-2 ring-[#f2b709]/20",
      danger: "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-100"
    }[tone];

    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-2xl border px-4 py-4 text-left text-sm transition ${
          selected
            ? selectedClass
            : "border-slate-200 bg-white text-slate-700 hover:border-[#009da8]/40 hover:bg-[#009da8]/5"
        }`}
      >
        <span className="block font-black">{title}</span>

        {description ? (
          <span className="mt-1 block text-xs font-semibold text-slate-500">
            {description}
          </span>
        ) : null}
      </button>
    );
  }

  function renderStep() {
    if (currentStep === 0) {
      return (
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="text-sm font-black text-slate-700">
              Código do paciente
            </label>

            <input
              value={form.patient_code}
              onChange={(event) => update("patient_code", event.target.value)}
              placeholder="Ex: PAC-001"
              className={fieldClass}
            />

            <p className="mt-2 text-xs font-semibold text-slate-500">
              Não informe o nome completo do paciente.
            </p>
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">
              Número do leito
            </label>

            <input
              value={form.bed_number}
              onChange={(event) => update("bed_number", event.target.value)}
              placeholder="Ex: 204A"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">
              Setor de origem
            </label>

            <select
              value={form.origin_sector_id}
              onChange={(event) =>
                update("origin_sector_id", event.target.value)
              }
              className={fieldClass}
            >
              <option value="">Selecione a origem</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name} {sector.floor ? `- ${sector.floor}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">
              Setor de destino
            </label>

            <select
              value={form.destination_sector_id}
              onChange={(event) =>
                update("destination_sector_id", event.target.value)
              }
              className={fieldClass}
            >
              <option value="">Selecione o destino</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name} {sector.floor ? `- ${sector.floor}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="space-y-6">
          <div>
            <label className="text-sm font-black text-slate-700">
              Motivo do transporte
            </label>

            <select
              value={form.transport_reason}
              onChange={(event) =>
                update("transport_reason", event.target.value)
              }
              className={fieldClass}
            >
              <option value="">Selecione o motivo</option>
              {transportReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">
              Prioridade operacional
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <SingleChoiceCard
                selected={form.priority === "normal"}
                onClick={() => update("priority", "normal")}
                title="Normal"
                description="Solicitação sem urgência operacional imediata."
              />

              <SingleChoiceCard
                selected={form.priority === "urgent"}
                onClick={() => update("priority", "urgent")}
                title="Urgente"
                description="Necessita prioridade no atendimento."
                tone="danger"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">
              Classificação de risco
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {riskOptions.map((option) => (
                <SingleChoiceCard
                  key={option.value}
                  selected={form.risk_classification === option.value}
                  onClick={() => applyRiskDefaults(option.value)}
                  title={option.label}
                  description={option.description}
                  tone={
                    option.value === "high"
                      ? "danger"
                      : option.value === "medium"
                        ? "gold"
                        : "primary"
                  }
                />
              ))}
            </div>

            <div className="mt-4">
              <InfoBox tone="gold">
                Ao selecionar o risco, o sistema sugere equipe e equipamentos
                mínimos. Você ainda pode ajustar nas próximas etapas.
              </InfoBox>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="space-y-6">
          <div>
            <label className="text-sm font-black text-slate-700">
              Precaução / isolamento
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {precautionOptions.map((option) => (
                <SingleChoiceCard
                  key={option.value}
                  selected={form.precaution_type === option.value}
                  onClick={() => handlePrecautionChange(option.value)}
                  title={option.label}
                  tone={option.value === "standard" ? "primary" : "gold"}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">
              Equipe multidisciplinar necessária
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {teamOptions.map((option) => (
                <OptionCard
                  key={option.value}
                  field="required_team"
                  option={option}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div>
          <label className="text-sm font-black text-slate-700">
            Equipamentos obrigatórios
          </label>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {equipmentOptions.map((option) => (
              <OptionCard
                key={option.value}
                field="required_equipment"
                option={option}
              />
            ))}
          </div>
        </div>
      );
    }

    if (currentStep === 4) {
      return (
        <div className="space-y-7">
          <div>
            <label className="text-sm font-black text-slate-700">
              Dispositivos invasivos
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {deviceOptions.map((option) => (
                <OptionCard
                  key={option.value}
                  field="invasive_devices"
                  option={option}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">
              Medicamentos ou infusões contínuas
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {medicationOptions.map((option) => (
                <OptionCard
                  key={option.value}
                  field="continuous_medications"
                  option={option}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">
              Documentos necessários
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {documentOptions.map((option) => (
                <OptionCard
                  key={option.value}
                  field="documents_required"
                  option={option}
                />
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer gap-3 rounded-2xl border border-[#009da8]/25 bg-[#009da8]/10 px-4 py-4 text-sm text-[#007983]">
            <input
              type="checkbox"
              checked={form.destination_contact_confirmed}
              onChange={(event) =>
                update("destination_contact_confirmed", event.target.checked)
              }
              className="mt-1 h-4 w-4 rounded border-[#009da8]"
            />

            <span>
              <span className="block font-black">
                Confirmo que o setor de destino foi avisado ou está ciente do
                transporte.
              </span>

              <span className="mt-1 block text-xs font-semibold text-slate-600">
                Essa confirmação ajuda a evitar atrasos e falhas de comunicação.
              </span>
            </span>
          </label>

          <div>
            <label className="text-sm font-black text-slate-700">
              Observações clínicas e operacionais
            </label>

            <textarea
              value={form.clinical_observations}
              onChange={(event) =>
                update("clinical_observations", event.target.value)
              }
              rows={3}
              placeholder="Ex: paciente em oxigenoterapia, necessário acompanhar sinais vitais..."
              className={fieldClass}
            />
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">
              Observações para o maqueiro
            </label>

            <textarea
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              rows={3}
              placeholder="Ex: chamar enfermagem antes de sair, aguardar liberação do setor..."
              className={fieldClass}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#009da8]/20 bg-[#009da8]/5 p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
            Revisão final
          </p>

          <h4 className="mt-2 text-lg font-black text-slate-950">
            Resumo da requisição
          </h4>

          <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-700 md:grid-cols-2">
            <p>
              <strong>Paciente:</strong> {form.patient_code || "Não informado"}
            </p>

            <p>
              <strong>Leito:</strong> {form.bed_number || "Não informado"}
            </p>

            <p>
              <strong>Origem:</strong>{" "}
              {getSectorLabel(sectors, form.origin_sector_id)}
            </p>

            <p>
              <strong>Destino:</strong>{" "}
              {getSectorLabel(sectors, form.destination_sector_id)}
            </p>

            <p>
              <strong>Motivo:</strong>{" "}
              {getOptionLabel(transportReasonOptions, form.transport_reason)}
            </p>

            <p>
              <strong>Prioridade:</strong>{" "}
              {form.priority === "urgent" ? "Urgente" : "Normal"}
            </p>

            <p>
              <strong>Risco:</strong>{" "}
              {getOptionLabel(riskOptions, form.risk_classification)}
            </p>

            <p>
              <strong>Precaução:</strong>{" "}
              {getOptionLabel(precautionOptions, form.precaution_type)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SummaryList
            title="Equipe necessária"
            values={form.required_team}
            options={teamOptions}
          />

          <SummaryList
            title="Equipamentos"
            values={form.required_equipment}
            options={equipmentOptions}
          />

          <SummaryList
            title="Dispositivos"
            values={form.invasive_devices}
            options={deviceOptions}
          />

          <SummaryList
            title="Documentos"
            values={form.documents_required}
            options={documentOptions}
          />
        </div>

        <InfoBox tone="success">
          Revise as informações antes de criar a requisição. Após confirmar, o
          chamado ficará pendente para atendimento.
        </InfoBox>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[1.5rem] border border-[#009da8]/20 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#009da8] via-[#009da8] to-[#006c74] p-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f2b709]">
                Transporte seguro
              </p>

              <h3 className="mt-2 text-2xl font-black tracking-tight">
                Requisição guiada de transporte
              </h3>

              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
                O formulário será preenchido em etapas, com sugestões
                automáticas conforme o risco e a precaução do paciente.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-fit rounded-2xl bg-[#f2b709] px-5 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:brightness-95"
            >
              Nova requisição
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-[#009da8]">
                    Transporte seguro do paciente
                  </p>

                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    {steps[currentStep]}
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Etapa {currentStep + 1} de {steps.length}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-5 hidden flex-wrap gap-3 lg:flex">
                {steps.map((step, index) => (
                  <StepIndicator
                    key={step}
                    index={index}
                    currentStep={currentStep}
                  />
                ))}
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#009da8] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <form
              action={action}
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              {renderHiddenFields()}

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                {error ? (
                  <div className="mb-5">
                    <InfoBox tone="danger">{error}</InfoBox>
                  </div>
                ) : null}

                <div key={currentStep} className="transition-all">
                  {renderStep()}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={currentStep === 0}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Voltar
                </button>

                {currentStep < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="rounded-xl bg-[#009da8] px-6 py-3 text-sm font-black text-white transition hover:brightness-95"
                  >
                    Próximo
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="rounded-xl bg-[#f2b709] px-6 py-3 text-sm font-black text-slate-950 transition hover:brightness-95"
                  >
                    Criar requisição
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}