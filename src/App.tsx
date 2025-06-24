import { useState, useEffect, useReducer, useCallback, useMemo } from 'react';
import { Play, Pause, RotateCcw, Plus, Trash2 } from 'lucide-react';

// 타입 정의
interface Process {
  id: number;
  name: string;
  arrival: number;
  burst: number;
  priority: number;
  remaining: number;
  color: string;
}

interface GanttEntry {
  process: string;
  start: number;
  end: number;
  color: string;
}

interface SimulationState {
  currentTime: number;
  ganttChart: GanttEntry[];
  currentProcess: Process | null;
  readyQueue: Process[];
  completedProcesses: number[];
  quantumRemaining: number;
  isRunning: boolean;
}

type SimulationAction =
  | {
      type: 'STEP';
      payload: { processes: Process[]; algorithm: string; quantum: number };
    }
  | { type: 'RESET'; payload: { processes: Process[] } }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'SET_TIME'; payload: number };

// 스케줄링 알고리즘
class SchedulingAlgorithms {
  static selectNext(
    processes: Process[],
    currentTime: number,
    algorithm: string
  ): Process | null {
    if (processes.length === 0) return null;

    const sortedProcesses = [...processes];

    switch (algorithm) {
      case 'FCFS':
        return sortedProcesses.sort((a, b) =>
          a.arrival === b.arrival ? a.id - b.id : a.arrival - b.arrival
        )[0];

      case 'SJF':
        return sortedProcesses.sort((a, b) =>
          a.burst === b.burst ? a.arrival - b.arrival : a.burst - b.burst
        )[0];

      case 'SRT':
        return sortedProcesses.sort((a, b) =>
          a.remaining === b.remaining
            ? a.arrival - b.arrival
            : a.remaining - b.remaining
        )[0];

      case 'Priority':
        return sortedProcesses.sort((a, b) =>
          a.priority === b.priority
            ? a.arrival - b.arrival
            : a.priority - b.priority
        )[0];

      case 'HRN':
        const processesWithRatio = sortedProcesses.map((p) => {
          const waiting = Math.max(0, currentTime - p.arrival);
          const responseRatio = (waiting + p.burst) / p.burst;
          return { ...p, responseRatio };
        });
        return processesWithRatio.sort((a, b) =>
          Math.abs(a.responseRatio - b.responseRatio) < 0.001
            ? a.arrival - b.arrival
            : b.responseRatio - a.responseRatio
        )[0];

      case 'RR':
        return sortedProcesses[0];

      default:
        return sortedProcesses[0];
    }
  }
}

// 시뮬레이션 상태 리듀서
function simulationReducer(
  state: SimulationState,
  action: SimulationAction
): SimulationState {
  switch (action.type) {
    case 'RESET':
      return {
        currentTime: 0,
        ganttChart: [],
        currentProcess: null,
        readyQueue: [],
        completedProcesses: [],
        quantumRemaining: 0,
        isRunning: false,
      };

    case 'START':
      return { ...state, isRunning: true };

    case 'PAUSE':
      return { ...state, isRunning: false };

    case 'STEP':
      return executeSimulationStep(state, action.payload);

    default:
      return state;
  }
}

function executeSimulationStep(
  state: SimulationState,
  {
    processes,
    algorithm,
    quantum,
  }: { processes: Process[]; algorithm: string; quantum: number }
): SimulationState {
  const {
    currentTime,
    ganttChart,
    readyQueue,
    completedProcesses,
    quantumRemaining,
  } = state;

  // 모든 프로세스 완료 확인
  const allCompleted = processes.every((p) => p.remaining === 0);
  if (allCompleted) {
    return { ...state, isRunning: false };
  }

  // 새로 도착한 프로세스들
  const arrivedProcesses = processes.filter(
    (p) =>
      p.arrival === currentTime &&
      !completedProcesses.includes(p.id) &&
      p.remaining > 0
  );

  let newReadyQueue = [...readyQueue];
  arrivedProcesses.forEach((p) => {
    if (!newReadyQueue.find((rp) => rp.id === p.id)) {
      newReadyQueue.push({ ...p });
    }
  });

  let currentProcess = state.currentProcess;
  let newQuantumRemaining = quantumRemaining;
  let newCompletedProcesses = [...completedProcesses];

  // 현재 프로세스 완료 확인
  if (currentProcess) {
    const currentProcessState = processes.find(
      (p) => p.id === currentProcess.id
    );
    if (currentProcessState?.remaining === 0) {
      newCompletedProcesses.push(currentProcess.id);
      newReadyQueue = newReadyQueue.filter((p) => p.id !== currentProcess.id);
      currentProcess = null;
      newQuantumRemaining = 0;
    }
  }

  // RR 퀀텀 만료 처리
  if (
    algorithm === 'RR' &&
    currentProcess &&
    quantumRemaining === 0 &&
    newReadyQueue.length > 1
  ) {
    newReadyQueue = newReadyQueue.filter((p) => p.id !== currentProcess.id);
    const currentProcessState = processes.find(
      (p) => p.id === currentProcess.id
    );
    if (currentProcessState?.remaining > 0) {
      newReadyQueue.push({ ...currentProcessState });
    }
    currentProcess = null;
  }

  // 다음 프로세스 선택
  if (
    !currentProcess ||
    (currentProcess && (algorithm === 'SRT' || algorithm === 'RR'))
  ) {
    // 추가: SRT나 RR만 선점 가능
    const availableProcesses = newReadyQueue.filter((p) => {
      const processState = processes.find((ps) => ps.id === p.id);
      return (
        processState?.remaining > 0 && !newCompletedProcesses.includes(p.id)
      );
    });

    if (availableProcesses.length > 0) {
      const nextSelected = SchedulingAlgorithms.selectNext(
        availableProcesses,
        currentTime,
        algorithm
      );

      // 비선점형 알고리즘의 경우, 현재 프로세스가 있다면 변경하지 않음 (RR, SRT 제외)
      if (
        currentProcess &&
        nextSelected &&
        currentProcess.id !== nextSelected.id &&
        algorithm !== 'SRT' &&
        algorithm !== 'RR'
      ) {
        // 현재 프로세스를 유지
      } else {
        currentProcess = nextSelected;
        if (currentProcess && algorithm === 'RR') {
          newQuantumRemaining = quantum;
        }
      }
    }
  }

  let newGanttChart = [...ganttChart];

  // 프로세스 실행 또는 IDLE
  if (currentProcess) {
    const lastEntry = newGanttChart[newGanttChart.length - 1];
    if (lastEntry?.process === currentProcess.name) {
      newGanttChart[newGanttChart.length - 1] = {
        ...lastEntry,
        end: currentTime + 1,
      };
    } else {
      newGanttChart.push({
        process: currentProcess.name,
        start: currentTime,
        end: currentTime + 1,
        color: currentProcess.color,
      });
    }

    if (algorithm === 'RR' && newQuantumRemaining > 0) {
      newQuantumRemaining -= 1;
    }
  } else {
    // CPU 유휴
    const hasUnArrived = processes.some(
      (p) => p.arrival > currentTime && p.remaining > 0
    );
    if (hasUnArrived) {
      const lastEntry = newGanttChart[newGanttChart.length - 1];
      if (lastEntry?.process === 'IDLE') {
        newGanttChart[newGanttChart.length - 1] = {
          ...lastEntry,
          end: currentTime + 1,
        };
      } else {
        newGanttChart.push({
          process: 'IDLE',
          start: currentTime,
          end: currentTime + 1,
          color: '#E5E7EB',
        });
      }
    }
  }

  return {
    ...state,
    currentTime: currentTime + 1,
    ganttChart: newGanttChart,
    currentProcess,
    readyQueue: newReadyQueue,
    completedProcesses: newCompletedProcesses,
    quantumRemaining: newQuantumRemaining,
  };
}

const CPUSchedulerSimulator = () => {
  const [processes, setProcesses] = useState<Process[]>([
    {
      id: 1,
      name: 'P1',
      arrival: 0,
      burst: 5,
      priority: 3,
      remaining: 5,
      color: '#FF6B6B',
    },
    {
      id: 2,
      name: 'P2',
      arrival: 2,
      burst: 3,
      priority: 1,
      remaining: 3,
      color: '#4ECDC4',
    },
    {
      id: 3,
      name: 'P3',
      arrival: 4,
      burst: 8,
      priority: 2,
      remaining: 8,
      color: '#45B7D1',
    },
    {
      id: 4,
      name: 'P4',
      arrival: 6,
      burst: 2,
      priority: 4,
      remaining: 2,
      color: '#96CEB4',
    },
  ]);

  const [algorithm, setAlgorithm] = useState('FCFS');
  const [quantum, setQuantum] = useState(2);

  const [simulationState, dispatch] = useReducer(simulationReducer, {
    currentTime: 0,
    ganttChart: [],
    currentProcess: null,
    readyQueue: [],
    completedProcesses: [],
    quantumRemaining: 0,
    isRunning: false,
  });

  // 프로세스 관리 함수들
  const addProcess = useCallback(() => {
    const newId = Math.max(...processes.map((p) => p.id), 0) + 1;
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FECA57',
      '#FF9FF3',
      '#54A0FF',
    ];
    const newProcess: Process = {
      id: newId,
      name: `P${newId}`,
      arrival: 0,
      burst: 3,
      priority: 1,
      remaining: 3,
      color: colors[newId % colors.length],
    };
    setProcesses((prev) => [...prev, newProcess]);
  }, [processes]);

  const deleteProcess = useCallback((id: number) => {
    setProcesses((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateProcess = useCallback(
    (id: number, field: keyof Process, value: string) => {
      const numValue = parseInt(value) || 0;
      setProcesses((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                [field]: numValue,
                remaining: field === 'burst' ? numValue : p.remaining,
              }
            : p
        )
      );
    },
    []
  );

  // 시뮬레이션 제어
  const executeStep = useCallback(() => {
    dispatch({ type: 'STEP', payload: { processes, algorithm, quantum } });
  }, [processes, algorithm, quantum]);

  const resetSimulation = useCallback(() => {
    dispatch({ type: 'RESET', payload: { processes } });
    setProcesses((prev) => prev.map((p) => ({ ...p, remaining: p.burst })));
  }, [processes]);

  // 자동 실행
  useEffect(() => {
    if (!simulationState.isRunning) return;

    const interval = setInterval(() => {
      const allCompleted = processes.every((p) => p.remaining === 0);
      if (allCompleted) {
        dispatch({ type: 'PAUSE' });
        return;
      }

      // 프로세스 상태 업데이트
      if (simulationState.currentProcess) {
        setProcesses((prev) =>
          prev.map((p) =>
            p.id === simulationState.currentProcess?.id
              ? { ...p, remaining: Math.max(0, p.remaining - 1) }
              : p
          )
        );
      }

      executeStep();
    }, 1000);

    return () => clearInterval(interval);
  }, [
    simulationState.isRunning,
    executeStep,
    processes,
    simulationState.currentProcess,
  ]);

  // 통계 계산
  const statistics = useMemo(() => {
    if (simulationState.ganttChart.length === 0) return null;

    const stats = processes.map((p) => {
      const processEntries = simulationState.ganttChart.filter(
        (g) => g.process === p.name
      );
      const completion =
        processEntries.length > 0
          ? Math.max(...processEntries.map((g) => g.end))
          : 0;
      const turnaround = completion - p.arrival;
      const waiting = turnaround - p.burst;

      return {
        name: p.name,
        arrival: p.arrival,
        burst: p.burst,
        completion,
        turnaround,
        waiting,
      };
    });

    const avgTurnaround =
      stats.reduce((sum, s) => sum + s.turnaround, 0) / stats.length;
    const avgWaiting =
      stats.reduce((sum, s) => sum + s.waiting, 0) / stats.length;

    return { stats, avgTurnaround, avgWaiting };
  }, [simulationState.ganttChart, processes]);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen overflow-x-hidden">
      {/* 이 div에 minWidth를 직접 적용합니다. */}
      <div
        className="bg-white rounded-lg shadow-lg p-6 mb-6"
        style={{ minWidth: '1000px' }} // 여기에 minWidth 적용
      >
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
          CPU 스케줄링 시뮬레이터
        </h1>

        {/* 알고리즘 선택 */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                스케줄링 알고리즘
              </label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="FCFS">FCFS (First Come First Served)</option>
                <option value="SJF">SJF (Shortest Job First)</option>
                <option value="SRT">SRT (Shortest Remaining Time)</option>
                <option value="Priority">Priority Scheduling</option>
                <option value="HRN">HRN (Highest Response Ratio Next)</option>
                <option value="RR">RR (Round Robin)</option>
              </select>
            </div>

            {algorithm === 'RR' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  타임 퀀텀
                </label>
                <input
                  type="number"
                  value={quantum}
                  onChange={(e) => setQuantum(parseInt(e.target.value) || 1)}
                  min="1"
                  className="px-3 py-2 border border-gray-300 rounded-md w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* 알고리즘 설명 */}
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">
            📋 {algorithm} 알고리즘 설명
          </h3>
          <p className="text-sm text-gray-700">
            {algorithm === 'FCFS' &&
              '도착 순서대로 프로세스를 실행합니다. 비선점형 스케줄링입니다.'}
            {algorithm === 'SJF' &&
              '실행 시간이 가장 짧은 프로세스를 우선 실행합니다. 비선점형 스케줄링입니다.'}
            {algorithm === 'SRT' &&
              '남은 실행 시간이 가장 짧은 프로세스를 우선 실행합니다. 선점형 스케줄링입니다.'}
            {algorithm === 'Priority' &&
              '우선순위가 높은(숫자가 작은) 프로세스를 우선 실행합니다. 비선점형입니다.'}
            {algorithm === 'HRN' &&
              '응답률(Response Ratio = (대기시간 + 실행시간) / 실행시간)이 높은 프로세스를 우선 실행합니다.'}
            {algorithm === 'RR' &&
              '각 프로세스에 동일한 시간 할당량(타임 퀀텀)을 부여하여 순환적으로 실행합니다.'}
          </p>
        </div>

        {/* 프로세스 관리 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              프로세스 관리
            </h2>
            <button
              onClick={addProcess}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            >
              <Plus size={16} /> 프로세스 추가
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2">프로세스</th>
                  <th className="border border-gray-300 px-4 py-2">도착시간</th>
                  <th className="border border-gray-300 px-4 py-2">실행시간</th>
                  {algorithm === 'Priority' && (
                    <th className="border border-gray-300 px-4 py-2">
                      우선순위
                    </th>
                  )}
                  <th className="border border-gray-300 px-4 py-2">남은시간</th>
                  {algorithm === 'HRN' && (
                    <th className="border border-gray-300 px-4 py-2">응답률</th>
                  )}
                  <th className="border border-gray-300 px-4 py-2">상태</th>
                  <th className="border border-gray-300 px-4 py-2">작업</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process) => (
                  <tr key={process.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: process.color }}
                        />
                        {process.name}
                      </div>
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <input
                        type="number"
                        value={process.arrival}
                        onChange={(e) =>
                          updateProcess(process.id, 'arrival', e.target.value)
                        }
                        className="w-16 px-2 py-1 border border-gray-200 rounded"
                        min="0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <input
                        type="number"
                        value={process.burst}
                        onChange={(e) =>
                          updateProcess(process.id, 'burst', e.target.value)
                        }
                        className="w-16 px-2 py-1 border border-gray-200 rounded"
                        min="1"
                      />
                    </td>
                    {algorithm === 'Priority' && (
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="number"
                          value={process.priority}
                          onChange={(e) =>
                            updateProcess(
                              process.id,
                              'priority',
                              e.target.value
                            )
                          }
                          className="w-16 px-2 py-1 border border-gray-200 rounded"
                          min="1"
                        />
                      </td>
                    )}
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <span className="font-mono">{process.remaining}</span>
                    </td>
                    {algorithm === 'HRN' && (
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        <span className="font-mono">
                          {process.arrival <= simulationState.currentTime &&
                          process.remaining > 0
                            ? (
                                (simulationState.currentTime -
                                  process.arrival +
                                  process.burst) /
                                process.burst
                              ).toFixed(2)
                            : '-'}
                        </span>
                      </td>
                    )}
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          simulationState.completedProcesses.includes(
                            process.id
                          )
                            ? 'bg-green-100 text-green-800'
                            : simulationState.currentProcess?.id === process.id
                            ? 'bg-blue-100 text-blue-800'
                            : simulationState.readyQueue.find(
                                (p) => p.id === process.id
                              )
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {simulationState.completedProcesses.includes(process.id)
                          ? '완료'
                          : simulationState.currentProcess?.id === process.id
                          ? '실행중'
                          : simulationState.readyQueue.find(
                              (p) => p.id === process.id
                            )
                          ? '대기'
                          : '미도착'}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <button
                        onClick={() => deleteProcess(process.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 제어 버튼 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() =>
              dispatch(
                simulationState.isRunning
                  ? { type: 'PAUSE' }
                  : { type: 'START' }
              )
            }
            className={`flex items-center gap-2 px-6 py-3 rounded-md text-white font-medium transition-colors ${
              simulationState.isRunning
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {simulationState.isRunning ? (
              <Pause size={20} />
            ) : (
              <Play size={20} />
            )}
            {simulationState.isRunning ? '일시정지' : '시작'}
          </button>

          <button
            onClick={executeStep}
            disabled={simulationState.isRunning}
            className="px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            단계 실행
          </button>

          <button
            onClick={resetSimulation}
            className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            <RotateCcw size={20} /> 초기화
          </button>
        </div>

        {/* 현재 상태 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="font-medium text-gray-700">현재 시간:</span>
              <span className="ml-2 font-mono text-lg">
                {simulationState.currentTime}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">실행 중:</span>
              <span className="ml-2">
                {simulationState.currentProcess
                  ? simulationState.currentProcess.name
                  : 'None'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">대기 큐:</span>
              <span className="ml-2">
                [{simulationState.readyQueue.map((p) => p.name).join(', ')}]
              </span>
            </div>
            {algorithm === 'RR' && (
              <div>
                <span className="font-medium text-gray-700">남은 퀀텀:</span>
                <span className="ml-2 font-mono">
                  {simulationState.quantumRemaining}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Gantt 차트 */}
        {simulationState.ganttChart.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Gantt 차트
            </h3>
            <div className="bg-white border border-gray-300 rounded-lg p-4 max-w-full overflow-x-auto">
              <div className="min-w-max">
                <div className="flex items-center mb-2 space-x-px">
                  {simulationState.ganttChart.map((entry, index) => (
                    <div
                      key={index}
                      className="flex-shrink-0 border border-gray-400 flex items-center justify-center font-medium text-white text-sm"
                      style={{
                        backgroundColor: entry.color,
                        width: `${(entry.end - entry.start) * 40}px`,
                        height: '40px',
                      }}
                    >
                      {entry.process}
                    </div>
                  ))}
                </div>
                <div className="flex items-center space-x-px">
                  {simulationState.ganttChart.map((entry, index) => (
                    <div
                      key={index}
                      className="flex-shrink-0 text-xs text-gray-600 border-r border-gray-300 pr-1"
                      style={{ width: `${(entry.end - entry.start) * 40}px` }}
                    >
                      {entry.start}
                    </div>
                  ))}
                  <div className="text-xs text-gray-600 ml-1">
                    {simulationState.ganttChart[
                      simulationState.ganttChart.length - 1
                    ]?.end ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 통계 */}
        {statistics && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              실행 통계
            </h3>
            <div className="overflow-x-auto mb-4">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2">
                      프로세스
                    </th>
                    <th className="border border-gray-300 px-4 py-2">
                      도착 시간
                    </th>
                    <th className="border border-gray-300 px-4 py-2">
                      실행 시간
                    </th>
                    <th className="border border-gray-300 px-4 py-2">
                      완료 시간
                    </th>
                    <th className="border border-gray-300 px-4 py-2">
                      Turnaround Time
                    </th>
                    <th className="border border-gray-300 px-4 py-2">
                      Waiting Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.stats.map((s) => (
                    <tr key={s.name} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {s.name}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {s.arrival}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {s.burst}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {s.completion}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {s.turnaround}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {s.waiting}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-gray-800 font-medium">
              평균 Turnaround Time:{' '}
              <span className="font-mono text-blue-600">
                {statistics.avgTurnaround.toFixed(2)}
              </span>
              &nbsp;| 평균 Waiting Time:{' '}
              <span className="font-mono text-blue-600">
                {statistics.avgWaiting.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CPUSchedulerSimulator;
