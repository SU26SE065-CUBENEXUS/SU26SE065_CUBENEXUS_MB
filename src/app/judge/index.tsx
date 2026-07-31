import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { JudgeDutyMode } from '@/features/judge/types';
import { getDutyMode, setDutyMode, clearJudgeStore } from '@/features/judge/services/judgeStore';

import JudgeDutySelection from '@/features/judge/components/JudgeDutySelection';
import CheckInDeskMode from '@/features/judge/components/CheckInDeskMode';
import StationJudgeMode from '@/features/judge/components/StationJudgeMode';

/**
 * Judge entry point — workflow container only.
 * 
 * Phase 0: Duty selection (CHECK_IN or STATION).
 * Phase 1: Check-in Desk mode (reception QR scan + recent list).
 * Phase 2: Station Judge mode (5-tab bottom navigation).
 * 
 * selectedDutyMode is local UI state — never sent to backend.
 */
export default function JudgeDashboard() {
  const router = useRouter();
  const { user, logout, accessToken } = useAuth();
  
  const getInitialDutyMode = (): JudgeDutyMode | null => {
    const saved = getDutyMode();
    if (saved) return saved;

    const judgeRole = (user?.judgeRoleCode || '').toUpperCase();
    const systemRole = (user?.role || '').toUpperCase();

    if (judgeRole.includes('CHECK_IN') || judgeRole.includes('CHECKIN') || judgeRole.includes('RECEPTION')) {
      return 'CHECK_IN';
    }
    if (judgeRole.includes('STATION') || judgeRole.includes('MAIN_JUDGE')) {
      return 'STATION';
    }
    if (systemRole.includes('CHECK_IN') || systemRole.includes('CHECKIN') || systemRole.includes('RECEPTION')) {
      return 'CHECK_IN';
    }
    if (systemRole.includes('JUDGE') || systemRole.includes('STATION')) {
      return 'STATION';
    }
    return null;
  };

  const [dutyMode, setDutyModeState] = useState<JudgeDutyMode | null>(getInitialDutyMode);

  const handleSelectDuty = (mode: JudgeDutyMode) => {
    setDutyMode(mode);
    setDutyModeState(mode);
  };

  const handleChangeDuty = () => {
    setDutyMode(null);
    setDutyModeState(null);
  };

  const handleLogout = () => {
    clearJudgeStore();
    logout();
    router.replace('/login');
  };

  return (
    <>
      {dutyMode === null && (
        <JudgeDutySelection
          onSelectDuty={handleSelectDuty}
          onLogout={handleLogout}
        />
      )}
      {dutyMode === 'CHECK_IN' && (
        <CheckInDeskMode
          token={accessToken}
          onChangeDuty={handleChangeDuty}
          onLogout={handleLogout}
        />
      )}
      {dutyMode === 'STATION' && (
        <StationJudgeMode
          token={accessToken}
          onChangeDuty={handleChangeDuty}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
