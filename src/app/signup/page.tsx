import CalibrationWizard from "../_components/CalibrationWizard";

/**
 * Sign up IS the calibration: account + identity + fund + lens + founder lens
 * + signals, reviewed and launched atomically (account → thesis → first sweep).
 */
export default function SignUpPage() {
  return <CalibrationWizard mode="signup" />;
}
