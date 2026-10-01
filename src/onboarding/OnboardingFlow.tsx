import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";
// Deliberately @firebase/auth, not the firebase/auth wrapper — see the
// long comment in src/config/firebase.ts. Mixing the two packages in the
// same app loads two different physical builds of Firebase's "auth"
// component, which crashes the app on launch before anything even renders.
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  type User,
} from "@firebase/auth";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { getOrCreateProfileId, setProfileId } from "@/utils/profileId";
import { Account, accountFromProfile } from "@/utils/account";
import { createProfile, findProfile, ProfileRecord } from "@/services/profiles";
import { auth, isFirebaseConfigured } from "@/config/firebase";
import { getDeviceInfo } from "@/utils/device";
import { buildLabel, useUpdateCheck } from "@/utils/updateCheck";
import { useToast } from "@/components/Toast";

type Mode = "signup" | "login";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  onComplete: (account: Account) => void;
}

function stripToLetters(text: string): string {
  return text.replace(/[^A-Za-z]/g, "").slice(0, 40);
}

/** Turns a Firebase Auth error code into something a person can act on. */
function authErrorMessage(err: unknown, fallback: string): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists — log in instead.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts — wait a bit and try again.";
    default:
      return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Organic overlapping-circles motif — recreated from the approved Figma
// Community reference ("Mobile App User Flow"), recolored into the app's
// own navy/teal palette. Confined to the card's top-right corner rather
// than full-bleed, so the real form content underneath still reads clearly.
// ─────────────────────────────────────────────────────────────────────────
function OrganicBlob() {
  return (
    <View style={styles.blobZone} pointerEvents="none">
      <View style={[styles.blob, styles.blobA]} />
      <View style={[styles.blob, styles.blobB]} />
      <View style={[styles.blob, styles.blobC]} />
    </View>
  );
}

function PencilIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z"
        stroke={colors.tealDark}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MailIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="14" rx="2.5" stroke={colors.tealDark} strokeWidth={2} />
      <Path d="M4 6.5 12 13l8-6.5" stroke={colors.tealDark} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LockIcon({ color = colors.tealDark }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="11" width="14" height="9" rx="2.5" stroke={color} strokeWidth={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function WarningIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 2 21h20L12 3Z" stroke="#DC2626" strokeWidth={2} strokeLinejoin="round" />
      <Path d="M12 10v4" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 17.5h.01" stroke="#DC2626" strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

/** An eye icon that toggles a password field between hidden and visible. */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
        stroke={colors.muted2}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke={colors.muted2} strokeWidth={2} />
      {!open && <Path d="M4 4l16 16" stroke={colors.muted2} strokeWidth={2} strokeLinecap="round" />}
    </Svg>
  );
}

/** A pill-shaped field with a leading icon — the base input treatment from the mockup. */
function Field({
  icon,
  error,
  ...inputProps
}: {
  icon: React.ReactNode;
  error?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[styles.field, error && styles.fieldError]}>
      {icon}
      <TextInput style={styles.fieldInput} placeholderTextColor={colors.muted2} {...inputProps} />
    </View>
  );
}

/** A pill-shaped password field with a leading lock icon and a trailing show/hide eye toggle. */
function PasswordField({
  value,
  onChangeText,
  placeholder,
  error,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  error?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={[styles.field, error && styles.fieldError]}>
      <LockIcon color={error ? "#DC2626" : colors.tealDark} />
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted2}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10} accessibilityLabel={visible ? "Hide password" : "Show password"}>
        <EyeIcon open={visible} />
      </Pressable>
    </View>
  );
}

/** The full-width navy→teal gradient capsule button from the mockup. */
function GradientButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [disabled && styles.primaryBtnDisabled, pressed && !disabled && { opacity: 0.9 }]}>
      <LinearGradient colors={[colors.navy, colors.tealDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

export function OnboardingFlow({ onComplete }: Props) {
  const [mode, setMode] = useState<Mode>("signup");
  const { showToast } = useToast();
  // Same manual update-check as Profile → tap the build label at the bottom.
  // Duplicated here on purpose: Profile is behind a login wall, so anyone
  // stuck failing to sign in has no other way to check whether their device
  // has actually picked up the latest OTA update yet.
  const { checking: checkingUpdate, checkForUpdateNow: runUpdateCheck } = useUpdateCheck();
  function checkForUpdateNow() {
    return runUpdateCheck(() => showToast("Update found — restarting…"));
  }

  // Sign up
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupBusy, setSignupBusy] = useState(false);
  /** Set right after a successful sign-up — swaps the form for a "check your inbox" panel. */
  const [awaitingVerification, setAwaitingVerification] = useState<string | null>(null);
  // Live mismatch feedback (red field + inline warning), same pattern as the
  // mockup — separate from handleSignUp's own submit-time guard below, which
  // still has the final say.
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Log in
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  /** The signed-in-but-unverified user, kept only so "Resend email" has something to call. */
  const [unverifiedUser, setUnverifiedUser] = useState<User | null>(null);
  const [resetSent, setResetSent] = useState(false);

  function switchMode(next: Mode) {
    setSignupError("");
    setLoginError("");
    setResendSent(false);
    setResetSent(false);
    setMode(next);
  }

  async function handleSignUp() {
    const nameValid = firstName.trim().length > 0 && lastName.trim().length > 0;
    const emailValid = EMAIL_RE.test(email.trim());
    const passwordValid = password.length >= 6;

    if (!nameValid) return setSignupError("Enter your first and last name.");
    if (!emailValid) return setSignupError("Enter a valid email address.");
    if (!passwordValid) return setSignupError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setSignupError("Passwords don't match.");

    setSignupBusy(true);
    setSignupError("");
    try {
      const cleanEmail = email.trim().toLowerCase();

      if (!isFirebaseConfigured || !auth) {
        setSignupError("Firebase isn't configured on this build — see SETUP.txt.");
        return;
      }

      const existing = await findProfile(cleanEmail);
      if (existing) {
        setSignupError("An account with this email already exists — log in instead.");
        return;
      }

      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await sendEmailVerification(credential.user);

      const avyayaId = await getOrCreateProfileId();
      const record: ProfileRecord = {
        userId: cleanEmail,
        email: cleanEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avyayaId,
        createdAtMs: Date.now(),
        device: getDeviceInfo(),
      };
      await createProfile(record);

      // Don't let them into the app yet — they come back and log in once the
      // link in their inbox confirms the email is really theirs.
      setAwaitingVerification(cleanEmail);
      setFirstName("");
      setLastName("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setSignupError(authErrorMessage(err, "Couldn't create your account — check your connection and try again."));
    } finally {
      setSignupBusy(false);
    }
  }

  async function handleLogin() {
    const cleanEmail = loginId.trim().toLowerCase();
    if (!cleanEmail || !loginPassword) {
      setLoginError("Enter your email and password.");
      return;
    }
    if (!isFirebaseConfigured || !auth) {
      setLoginError("Logging in to an existing account needs the Firebase setup in SETUP.txt.");
      return;
    }
    setLoginBusy(true);
    setLoginError("");
    setResendSent(false);
    setUnverifiedUser(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, loginPassword);

      if (!credential.user.emailVerified) {
        setUnverifiedUser(credential.user);
        setLoginError("Verify your email first — check your inbox for the activation link, then log in again.");
        return;
      }

      const profile = await findProfile(cleanEmail);
      if (!profile) {
        setLoginError("Couldn't find your account details — try signing up again.");
        return;
      }
      await setProfileId(profile.avyayaId);
      onComplete(accountFromProfile(profile));
    } catch (err) {
      setLoginError(authErrorMessage(err, "Couldn't log in — check your connection and try again."));
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleResend() {
    if (!unverifiedUser) return;
    setResendBusy(true);
    try {
      await sendEmailVerification(unverifiedUser);
      setResendSent(true);
    } catch {
      // Quietly ignore — the original link they already have still works.
    } finally {
      setResendBusy(false);
    }
  }

  async function handleForgotPassword() {
    const cleanEmail = loginId.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail) || !auth) {
      setLoginError("Enter your email above first, then tap 'Forgot password?'.");
      return;
    }
    setLoginError("");
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setResetSent(true);
    } catch (err) {
      setLoginError(authErrorMessage(err, "Couldn't send a reset email — check the address and try again."));
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <OrganicBlob />

          {mode === "signup" && awaitingVerification ? (
            <>
              <View style={styles.head}>
                <Text style={styles.title}>Check your inbox</Text>
                <Text style={styles.subtitle}>
                  We've sent an activation link to{"\n"}
                  <Text style={styles.subtitleStrong}>{awaitingVerification}</Text>
                </Text>
              </View>
              <View style={styles.form}>
                <Text style={styles.notice}>
                  Open that email and tap the link to activate your account, then come back here and log in with your
                  password.
                </Text>
                <GradientButton
                  label="Go to Log In"
                  onPress={() => {
                    setLoginId(awaitingVerification);
                    setAwaitingVerification(null);
                    setMode("login");
                  }}
                />
              </View>
            </>
          ) : mode === "signup" ? (
            <>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Rect x="3" y="3" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
                    <Rect x="3" y="13" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
                    <Rect x="13" y="13" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
                    <Rect x="13" y="3" width="8" height="8" rx="1.5" fill={colors.teal} />
                    <Path d="M14.8 9.2 17 7l1.4 1.4L20.2 6" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M18.2 6h2v2" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.brandName}>Avyaya</Text>
              </View>

              <View style={styles.head}>
                <Text style={styles.title}>Create your{"\n"}account</Text>
                <Text style={styles.subtitle}>Just your name, email & a password</Text>
              </View>

              <View style={styles.form}>
                <View style={styles.row}>
                  <View style={styles.flex1}>
                    <Field icon={<PencilIcon />} value={firstName} onChangeText={(t) => setFirstName(stripToLetters(t))} placeholder="First name" autoCapitalize="words" />
                  </View>
                  <View style={styles.flex1}>
                    <Field icon={<PencilIcon />} value={lastName} onChangeText={(t) => setLastName(stripToLetters(t))} placeholder="Last name" autoCapitalize="words" />
                  </View>
                </View>

                <Field
                  icon={<MailIcon />}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <PasswordField value={password} onChangeText={setPassword} placeholder="Password" />
                <PasswordField value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" error={passwordsMismatch} />
                {passwordsMismatch && (
                  <View style={styles.errorRow}>
                    <WarningIcon />
                    <Text style={styles.errorRowText}>Passwords don't match</Text>
                  </View>
                )}

                {!isFirebaseConfigured && (
                  <Text style={styles.notice}>
                    Firebase isn't configured on this build — signing up needs the setup in SETUP.txt.
                  </Text>
                )}
                {!!signupError && <Text style={styles.error}>{signupError}</Text>}

                <GradientButton label="Create account" onPress={handleSignUp} disabled={signupBusy} busy={signupBusy} />
                <Text style={styles.hint}>We'll email you a link to activate your account before you can log in.</Text>

                <Pressable onPress={() => switchMode("login")} hitSlop={6} style={styles.switchWrap}>
                  <Text style={styles.switchText}>
                    Already have an account? <Text style={styles.switchLink}>Log in</Text>
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Rect x="3" y="3" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
                    <Rect x="3" y="13" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
                    <Rect x="13" y="13" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
                    <Rect x="13" y="3" width="8" height="8" rx="1.5" fill={colors.teal} />
                    <Path d="M14.8 9.2 17 7l1.4 1.4L20.2 6" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M18.2 6h2v2" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.brandName}>Avyaya</Text>
              </View>

              <View style={styles.head}>
                <Text style={styles.title}>Welcome{"\n"}back!</Text>
                <Text style={styles.subtitle}>Log in with your Avyaya account</Text>
              </View>

              <View style={styles.form}>
                <Field
                  icon={<MailIcon />}
                  value={loginId}
                  onChangeText={setLoginId}
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <PasswordField value={loginPassword} onChangeText={setLoginPassword} placeholder="Password" />

                <Pressable onPress={handleForgotPassword} hitSlop={6} style={styles.forgotWrap}>
                  <Text style={styles.link}>Forgot password?</Text>
                </Pressable>
                {resetSent && <Text style={styles.success}>Password reset email sent — check your inbox.</Text>}

                {!!loginError && <Text style={styles.error}>{loginError}</Text>}

                {unverifiedUser && (
                  <Pressable onPress={handleResend} disabled={resendBusy} style={styles.resendWrap}>
                    <Text style={styles.link}>{resendSent ? "Verification email resent ✓" : resendBusy ? "Sending…" : "Resend verification email"}</Text>
                  </Pressable>
                )}

                <GradientButton label="Log in" onPress={handleLogin} disabled={loginBusy} busy={loginBusy} />

                <Pressable onPress={() => switchMode("signup")} hitSlop={6} style={styles.switchWrap}>
                  <Text style={styles.switchText}>
                    Don't have an account? <Text style={styles.switchLink}>Sign up</Text>
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <Pressable onPress={checkForUpdateNow} disabled={checkingUpdate} hitSlop={10}>
          <Text style={styles.buildLabel}>
            {checkingUpdate ? "Checking for updates…" : buildLabel() + "  ·  tap to check for updates"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  // justifyContent: "center" here was the bug behind "can't swipe up on
  // signup/login" — a well-known React Native gotcha: when a ScrollView's
  // contentContainerStyle centers its content AND that content is taller
  // than the screen (a long form, an error message, the keyboard open),
  // scrolling to reach what's centered "above" the visible area breaks. A
  // top-anchored layout (padding alone) scrolls correctly at any content
  // height, and looks the same as centered when the form already fits.
  scroll: { flexGrow: 1, padding: 20, paddingTop: 28 },
  buildLabel: {
    marginTop: 22,
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
    color: colors.muted2,
    opacity: 0.8,
    textAlign: "center",
    textDecorationLine: "underline",
  },

  // Card is the "screen" the organic blob sits inside — clipped so the
  // circles never spill past the rounded corners.
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 24, overflow: "hidden" },

  // Organic overlapping-circles motif, confined to the top-right corner.
  blobZone: { position: "absolute", top: 0, right: 0, width: "100%", height: 150 },
  blob: { position: "absolute", borderRadius: 999 },
  blobA: { width: 150, height: 150, right: -50, top: -45, backgroundColor: colors.tealTint },
  blobB: { width: 108, height: 108, right: -20, top: 8, backgroundColor: colors.teal, opacity: 0.92 },
  blobC: { width: 64, height: 64, right: 44, top: -14, backgroundColor: colors.navy, opacity: 0.94 },

  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 20, paddingHorizontal: 22 },
  brandMark: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  brandName: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.navy },

  head: { paddingTop: 18, paddingHorizontal: 22 },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 26, lineHeight: 31, color: colors.navy },
  subtitle: { marginTop: 8, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.muted },
  subtitleStrong: { fontFamily: fonts.bodyBold, color: colors.navy },

  form: { padding: 22, paddingTop: 18, gap: 12 },

  row: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },

  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    borderRadius: 999,
    paddingHorizontal: 18,
    backgroundColor: colors.appBg,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  fieldError: { backgroundColor: "#FDECEC", borderColor: "#DC2626" },
  fieldInput: { flex: 1, height: "100%", fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.navy2 },

  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4, paddingLeft: 6 },
  errorRowText: { fontFamily: fonts.bodySemibold, fontSize: 11.5, color: "#DC2626" },

  notice: { fontFamily: fonts.bodyRegular, fontSize: 11.5, lineHeight: 16.5, color: colors.muted, backgroundColor: colors.appBg, borderRadius: 12, padding: 12 },
  error: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: "#B91C1C", textAlign: "center" },
  success: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: "#15803D", textAlign: "center" },

  forgotWrap: { alignSelf: "flex-end" },
  resendWrap: { alignSelf: "center" },
  link: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.tealDark },

  primaryBtn: { height: 52, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: "#fff" },
  hint: { fontFamily: fonts.bodyRegular, fontSize: 11.5, lineHeight: 16.5, color: colors.muted2, textAlign: "center" },

  switchWrap: { alignSelf: "center", marginTop: 2 },
  switchText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  switchLink: { fontFamily: fonts.bodyBold, color: colors.tealDark },
});
