import CalibrationWizard from "../_components/CalibrationWizard";

/** Signed-in recalibration · same console, prefilled from the committed thesis. */
export default function OnboardingPage() {
  return <CalibrationWizard mode="recalibrate" />;
}
