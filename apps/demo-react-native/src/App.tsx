import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormCoach, FormCoachCamera, Session } from '@formcoach/react-native';

/**
 * Demo app matching the integration shown in spec section 9. This cannot be run on a
 * simulator/device in this environment (no Xcode/Android Studio/physical device), so
 * it has not been executed here — see ../README.md. It is kept as a faithful reference
 * for how a host app would wire up the SDK; `npm run demo:cli` in this package proves
 * the same facade (minus FormCoachCamera, which needs the real RN runtime) actually
 * runs end-to-end against the live FormCoach API.
 */
const API_BASE_URL = 'http://localhost:4000';
// Paste the `publicIdentifier` from a PRODUCTION (or DEVELOPMENT) environment created
// in the portal — see apps/portal, Applications -> your app -> Environments.
const ENVIRONMENT_PUBLIC_IDENTIFIER = 'fc_env_replace_me';

export function App() {
  const [log, setLog] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const sessionRef = useRef<Session | null>(null);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-19), line]);
  }, []);

  useEffect(() => {
    FormCoach.initialize({
      appId: ENVIRONMENT_PUBLIC_IDENTIFIER,
      environment: 'production',
      inference: { targetFps: 24, processingResolution: '720p' },
      privacy: { processLocally: true, uploadVideo: false, collectUsage: true },
    })
      .then(() => {
        setReady(true);
        appendLog('FormCoach initialized.');
      })
      .catch((err) => appendLog(`initialize() failed: ${err.message}`));
  }, [appendLog]);

  const onCreateAndStart = useCallback(async () => {
    const session = await FormCoach.createSession({
      exercise: 'squat',
      camera: { facing: 'back' },
      subject: { requiredView: 'side' },
      feedback: { visual: true, voice: false, haptic: true },
    });
    sessionRef.current = session;
    setRepCount(0);

    session.on('repCompleted', (event) => {
      setRepCount(event.repCount);
      appendLog(`Rep ${event.repCount} completed (${event.quality}).`);
    });
    session.on('formIssue', (event) => appendLog(`Form issue: ${event.message}`));
    session.on('trackingUpdate', (event) => appendLog(`Tracking: ${event.status}`));
    session.on('calibrationRequired', (event) => appendLog(`Calibration needed: ${event.guidance}`));

    await session.start();
    appendLog('Session started.');
  }, [appendLog]);

  const onPause = useCallback(() => sessionRef.current?.pause(), []);
  const onResume = useCallback(() => sessionRef.current?.resume(), []);
  const onStop = useCallback(async () => {
    const summary = await sessionRef.current?.stop();
    if (summary) appendLog(`Session complete: ${summary.repCount} reps.`);
  }, [appendLog]);
  const onDispose = useCallback(async () => {
    await sessionRef.current?.dispose();
    sessionRef.current = null;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>FormCoach demo — Squat</Text>
      <Text style={styles.subtitle}>{ready ? 'Ready' : 'Initializing...'}</Text>

      {sessionRef.current && (
        <FormCoachCamera session={sessionRef.current} showSkeleton style={styles.camera} />
      )}

      <Text style={styles.repCount}>Reps: {repCount}</Text>

      <View style={styles.row}>
        <Button title="Create + start" onPress={onCreateAndStart} disabled={!ready} />
        <Button title="Pause" onPress={onPause} />
        <Button title="Resume" onPress={onResume} />
      </View>
      <View style={styles.row}>
        <Button title="Stop" onPress={onStop} />
        <Button title="Dispose" onPress={onDispose} />
      </View>

      <ScrollView style={styles.log}>
        {log.map((line, i) => (
          <Text key={i} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12', padding: 16 },
  title: { color: '#e6e8ef', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#9aa0b4', marginBottom: 12 },
  camera: { height: 200, borderRadius: 8, marginBottom: 12 },
  repCount: { color: '#e6e8ef', fontSize: 28, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  log: { flex: 1, marginTop: 12, backgroundColor: '#151822', borderRadius: 8, padding: 8 },
  logLine: { color: '#9aa0b4', fontSize: 12, marginBottom: 2 },
});
