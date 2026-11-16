import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface ExerciseSummary {
  id: string;
  name: string;
  description: string;
  publicationStatus: string;
  supportedViews: string[];
  currentVersion: string;
}

export function ExercisesPage() {
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);

  useEffect(() => {
    api.get<ExerciseSummary[]>('/v1/exercises').then(setExercises);
  }, []);

  return (
    <div>
      <h2>Exercise catalogue</h2>
      <p className="muted">Only published exercises are shown — this mirrors what the SDK catalogue returns to host apps.</p>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Exercise</th>
              <th>Views</th>
              <th>Status</th>
              <th>Version</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link to={`/exercises/${e.id}`}>{e.name}</Link>
                </td>
                <td className="muted">{e.supportedViews.join(', ')}</td>
                <td>
                  <span className="badge">{e.publicationStatus}</span>
                </td>
                <td className="muted">{e.currentVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ExerciseDetails extends ExerciseSummary {
  instructions: string;
  limitations: string[];
  setupGuidance: string;
  evaluatorVersion: string;
}

export function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const [exercise, setExercise] = useState<ExerciseDetails | null>(null);

  useEffect(() => {
    if (exerciseId) api.get<ExerciseDetails>(`/v1/exercises/${exerciseId}`).then(setExercise);
  }, [exerciseId]);

  if (!exercise) return <p>Loading...</p>;

  return (
    <div>
      <h2>{exercise.name}</h2>
      <div className="card">
        <p>{exercise.description}</p>
        <p className="muted">{exercise.instructions}</p>
        <table>
          <tbody>
            <tr>
              <th>Supported views</th>
              <td>{exercise.supportedViews.join(', ')}</td>
            </tr>
            <tr>
              <th>Evaluator version</th>
              <td>{exercise.evaluatorVersion}</td>
            </tr>
            <tr>
              <th>Setup guidance</th>
              <td>{exercise.setupGuidance}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {exercise.limitations.length > 0 && (
        <div className="card">
          <h3>Known limitations</h3>
          <ul>
            {exercise.limitations.map((l) => (
              <li key={l} className="muted">
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
