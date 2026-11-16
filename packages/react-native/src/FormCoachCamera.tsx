import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { TrackingStatus } from '@formcoach/types';
import type { Session } from './session';

export interface FormCoachCameraProps {
  session: Session;
  showSkeleton?: boolean;
  showLandmarks?: boolean;
  style?: ViewStyle;
}

/**
 * Real builds render the native camera preview (CameraX/AVFoundation) here, with
 * skeleton/landmark overlays drawn natively — raw frames never cross into JS (spec
 * 7.2/9.5). No native camera exists in this environment, so this component renders a
 * placeholder that reflects live tracking status from the session's events, which is
 * enough to demonstrate correct mount/unmount and session-ownership behaviour.
 *
 * Unmounting this component must never dispose a session it does not own — the caller
 * created the session and is responsible for calling session.dispose().
 */
export function FormCoachCamera({ session, showSkeleton = false, style }: FormCoachCameraProps) {
  const [status, setStatus] = useState<TrackingStatus>('calibrating');

  useEffect(() => {
    const unsubscribe = session.on('trackingUpdate', (event) => setStatus(event.status));
    return () => unsubscribe();
  }, [session]);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.placeholderTitle}>FormCoach camera preview</Text>
      <Text style={styles.placeholderBody}>
        No native camera module is available in this build. Tracking status: {status}
      </Text>
      {showSkeleton && <Text style={styles.placeholderBody}>(Skeleton overlay requires the native renderer.)</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#11131a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  placeholderTitle: {
    color: '#e6e8ef',
    fontWeight: '600',
    marginBottom: 4,
  },
  placeholderBody: {
    color: '#9aa0b4',
    fontSize: 12,
    textAlign: 'center',
  },
});
