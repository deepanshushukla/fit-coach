# FormCoach --- Product Requirements & Technical Specification

**Document type:** Product Requirements Document (PRD) + Technical
Design Document (TDD)\
**Version:** 1.0\
**Status:** Proposed baseline for implementation\
**Date:** 15 November 2026

------------------------------------------------------------------------

## 1. Executive summary

FormCoach is a cross-platform exercise intelligence SDK and management
platform that fitness applications can embed to provide camera-based
exercise tracking and technique feedback.

The SDK processes camera frames on the user's device, estimates body
landmarks, evaluates exercise-specific movement rules, counts
repetitions, and emits structured feedback to the host application. The
initial product is not a workout marketplace or a medical/rehabilitation
product. It is an embeddable technology platform.

FormCoach consists of four products:

1.  **Mobile SDKs** for React Native, Expo development builds, native
    Android, native iOS, and Flutter.
2.  **Exercise intelligence runtime**: pose estimation, geometry,
    exercise state machines, rep counting, form checks, and feedback.
3.  **Management portal**: customer organisations, team members, apps,
    environments, plans, licences, exercise entitlements, usage and
    audit.
4.  **Backend services**: identity, organisation and app management,
    licensing, signed entitlement issuance, usage ingestion, and
    optional billing integration.

### 1.1 Product principles

-   Run pose inference and exercise evaluation on-device by default.
-   Do not upload continuous camera video or raw frames.
-   Share the pose model across exercises; implement and validate each
    exercise evaluator independently.
-   Prefer no feedback over incorrect feedback when tracking quality is
    insufficient.
-   Keep camera processing native; do not stream full frame buffers
    through the React Native or Flutter bridge.
-   Licensing must not require a network request for every frame,
    repetition, or feedback event.
-   Make platform support and exercise limitations explicit.
-   Treat accuracy as a measured product property, not a marketing
    assumption.

------------------------------------------------------------------------

## 2. Problem statement

Fitness applications can display exercise videos and count manually
entered workouts, but implementing reliable camera-based exercise
tracking is difficult. Each app would otherwise need to solve camera
lifecycle management, pose inference, platform-specific native code,
movement analysis, repetition counting, feedback, device performance,
privacy, and ongoing model maintenance.

FormCoach provides a reusable engine and consistent APIs so customer
apps can integrate exercise intelligence without independently building
the entire computer-vision and biomechanics pipeline.

### 2.1 Target customers

-   Fitness and workout mobile applications.
-   Personal training and coaching platforms.
-   Corporate wellness products.
-   Connected fitness products that use a phone or tablet camera.
-   Digital fitness platforms that need embedded exercise modules.

### 2.2 Primary users

  -----------------------------------------------------------------------
  Persona                             Needs
  ----------------------------------- -----------------------------------
  Customer organisation owner         Create organisation, manage
                                      subscription and team

  Customer developer                  Create app credentials, integrate
                                      SDK, inspect docs and usage

  Customer analyst                    Review usage and integration health

  FormCoach super admin               Manage customers, plans, exercises
                                      and platform operations

  FormCoach exercise administrator    Publish and version exercise
                                      evaluators

  Exerciser                           Use the customer app's exercise
                                      experience
  -----------------------------------------------------------------------

An exerciser does not need a separate FormCoach account. Their identity
and workout history normally remain with the host fitness application.

------------------------------------------------------------------------

## 3. Goals, non-goals and success measures

### 3.1 Goals

-   Deliver a stable SDK contract across supported platforms.
-   Ship an initial set of validated exercises.
-   Provide repetition counting and conservative form feedback.
-   Allow customer organisations to manage apps and exercise
    entitlements.
-   Support offline workout sessions using cached, signed entitlements.
-   Give customers visibility into licence status, SDK version and
    usage.
-   Provide a clear path to add exercises without changing the public
    SDK API unnecessarily.

### 3.2 Non-goals for the first release

-   Medical diagnosis, injury detection, rehabilitation prescription or
    treatment.
-   Guaranteed injury prevention or claims that a user is exercising
    safely.
-   Cloud-based continuous video analysis.
-   Social networking, workout plans, nutrition, payments for end users,
    or a consumer workout marketplace.
-   A universal guarantee that every exercise works from every camera
    angle or on every device.
-   Arbitrary customer-authored exercise algorithms in the first
    release.
-   Real-time cloud inference or per-frame backend calls.
-   Support for Expo Go unless a later technical proof demonstrates that
    all required native capabilities can run there. The supported Expo
    path is a custom development build.

### 3.3 Initial success measures

These are launch targets to validate, not claims about current
performance.

-   SDK initialisation succeeds on supported test devices at a defined
    target rate.
-   Camera and inference pipeline sustains the target frame rate on the
    minimum supported device matrix.
-   Rep-count precision and recall are measured per exercise, camera
    view and device class.
-   False-positive form alerts are low enough to be acceptable in
    trainer-reviewed sessions.
-   Exercise evaluation abstains when required landmarks or camera views
    are unavailable.
-   Customer can create an app, assign a plan, refresh entitlements and
    run an offline session.
-   No raw video is transmitted in the default configuration.
-   SDK crash rate, inference latency, memory use and thermal behaviour
    are instrumented.

------------------------------------------------------------------------

## 4. Product scope and release plan

### 4.1 Proposed initial exercise catalogue

The first release should contain a small number of exercises rather than
a large unvalidated catalogue.

  -----------------------------------------------------------------------
  Exercise ID       Initial tier      Candidate         Notes
                                      required view     
  ----------------- ----------------- ----------------- -----------------
  `squat`           Community         Side or supported Lower-body
                                      3/4 view,         movement and
                                      validated         depth proxy
                                      separately        

  `push_up`         Community         Side              Horizontal body
                                                        alignment and
                                                        elbow movement

  `lunge`           Community         Front or side     Must distinguish
                                      depending on rule supported
                                                        view-specific
                                                        checks
  -----------------------------------------------------------------------

The exact supported views and rules must be established through testing.
Do not imply that a rule is valid from a view where its landmarks are
occluded or geometrically ambiguous.

Paid catalogue candidates can include `bicep_curl`, `shoulder_press`,
`deadlift`, `plank`, `glute_bridge`, and others. Each must pass the same
exercise publication checklist before it is offered as licensed.

### 4.2 Exercise is a deliverable, not a catalogue label

An exercise is considered supported only when it has:

-   Exercise definition and stable ID.
-   Supported camera/body views.
-   Required landmarks and confidence thresholds.
-   Measurements and geometry definitions.
-   Calibration requirements.
-   Movement phases and state machine.
-   Rep counting rules.
-   Form checks with view constraints.
-   Confidence and abstention behaviour.
-   Feedback text and severity/priority.
-   Unit, replay and device tests.
-   Annotated validation data and trainer review.
-   Known limitations and version history.

Adding an exercise means shipping and validating an evaluator, not
simply adding a string to a list.

### 4.3 Phases

**Phase 0 --- Technical feasibility** - Prove camera capture and
on-device pose inference on representative Android and iOS devices. -
Measure inference latency, frame rate, memory and thermal behaviour. -
Validate model licence and redistribution terms. - Demonstrate one
exercise with offline processing.

**Phase 1 --- SDK foundation** - Native Android and iOS engines. -
Shared types and event contracts. - React Native integration. - First
exercise modules. - Demo applications and test harness.

**Phase 2 --- Portal and licensing** - Customer accounts, organisations,
apps and environments. - Plans, licences and exercise entitlements. -
Signed entitlement issuance and offline verification. - Usage ingestion
and audit.

**Phase 3 --- Cross-platform expansion** - Expo config plugin and custom
development build support. - Flutter plugin. - Documentation, sample
apps and release automation.

**Phase 4 --- Commercial readiness** - Billing integration if
required. - Support workflows, customer analytics, SLA/enterprise
controls. - Additional validated exercises and device coverage.

------------------------------------------------------------------------

## 5. User journeys

### 5.1 Customer onboarding

1.  Customer creates an account.
2.  Customer verifies email and creates an organisation.
3.  Organisation owner invites developers and analysts.
4.  Customer creates an application.
5.  Customer creates development, staging and production environments.
6.  Portal displays the application ID and platform integration
    instructions.
7.  Customer selects a plan or starts a trial.
8.  Customer assigns a licence to the application.
9.  SDK integration retrieves the signed entitlement.
10. Customer tests included exercises and sees usage in the portal.

### 5.2 Exerciser session

1.  Host app asks the user for camera permission and explains camera
    use.
2.  Host app creates a FormCoach session for an exercise.
3.  SDK verifies the local entitlement and exercise availability.
4.  SDK starts camera capture and pose inference.
5.  SDK checks whether the body is visible and whether the required view
    is satisfied.
6.  SDK calibrates if needed.
7.  SDK emits tracking status and exercise feedback.
8.  SDK counts repetitions only when a complete valid movement cycle is
    detected.
9.  SDK emits a session summary.
10. Host app stores or syncs the summary according to its own privacy
    policy.

### 5.3 Customer upgrades a plan

1.  Organisation owner changes the subscription or plan in the portal.
2.  Backend updates the licence and entitlement set.
3.  Backend issues a newly signed entitlement.
4.  SDK refreshes the entitlement on next launch, explicit refresh or
    configured interval.
5.  Newly licensed exercises become available.
6.  If the device is offline, it continues to use the last valid
    entitlement within the configured offline grace period.

------------------------------------------------------------------------

## 6. Functional requirements

Priority definitions: **P0** required for initial commercial release;
**P1** important follow-up; **P2** later enhancement.

### 6.1 Management portal

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  PORT-001                Secure sign-in,         P0
                          sign-out and account    
                          recovery                

  PORT-002                Create and manage       P0
                          organisations           

  PORT-003                Invite, remove and      P0
                          assign organisation     
                          members                 

  PORT-004                Role-based access       P0
                          control                 

  PORT-005                Create applications and P0
                          environments            

  PORT-006                Show app ID and         P0
                          platform setup          
                          instructions            

  PORT-007                Create and assign       P0
                          licences                

  PORT-008                Display plan and        P0
                          exercise entitlements   

  PORT-009                Display current licence P0
                          status and expiry       

  PORT-010                Usage dashboard by app, P1
                          environment, exercise   
                          and period              

  PORT-011                Audit log for           P0
                          administrative changes  

  PORT-012                Rotate/revoke           P0
                          credentials and signing 
                          keys safely             

  PORT-013                SDK compatibility       P1
                          matrix and release      
                          notes                   

  PORT-014                Billing and invoices    P1

  PORT-015                Support tickets and     P2
                          diagnostics export      
  -----------------------------------------------------------------------

Portal screens:

-   Sign in / create account / password recovery.
-   Organisation setup.
-   Organisation overview.
-   Members and invitations.
-   Applications list and application details.
-   Environment and platform configuration.
-   Licence overview and licence detail.
-   Plan and subscription management.
-   Exercise catalogue and exercise detail.
-   Usage analytics.
-   Audit log.
-   SDK releases and documentation.
-   FormCoach internal administration screens.

### 6.2 Organisation and role management

Suggested roles:

  -----------------------------------------------------------------------
  Role                                Permissions
  ----------------------------------- -----------------------------------
  FormCoach super admin               Full platform administration

  FormCoach support                   Read customer state and approved
                                      diagnostics; limited mutation

  FormCoach exercise admin            Create, test and publish exercise
                                      versions

  Organisation owner                  Manage organisation, members, apps,
                                      licences and billing

  Organisation admin                  Manage members and apps; licence
                                      permissions configurable

  Developer                           Read app configuration, use SDK
                                      credentials, view integration
                                      diagnostics

  Analyst                             Read-only usage and reports
  -----------------------------------------------------------------------

Enforce permissions on the backend, not only by hiding portal controls.
Every sensitive mutation must create an audit event.

### 6.3 Applications and environments

An organisation can own multiple applications. An application can have
environments such as:

-   `development`
-   `staging`
-   `production`

Each environment has: - Stable environment ID. - Public
application/environment identifier. - Platform allow-list and
bundle/package identifiers where appropriate. - Allowed SDK versions. -
Licence association. - Creation and last-used timestamps. - Credential
status and rotation history.

Do not treat an identifier embedded in a mobile binary as a secret. It
can be extracted. Use it to identify the app/environment, not as sole
proof of authorisation.

### 6.4 Exercise catalogue

Each exercise record includes: - Stable ID and display name. -
Description and instructions. - Publication status: draft, testing,
published, deprecated. - Version and compatibility metadata. - Supported
platforms and minimum SDK version. - Supported body views. - Required
landmarks and confidence rules. - Entitlement tier. - Known
limitations. - Evaluator version and model compatibility.

The public catalogue should not expose unpublished exercises or internal
evaluator source.

### 6.5 Licensing and entitlements

Plans define the exercises and capabilities included. A licence assigns
a plan to an application or organisation according to the commercial
contract.

Example plans:

  Plan         Example entitlement
  ------------ ---------------------------------------------------------
  Community    3 named exercises
  Pro          Up to 20--30 published exercises, depending on contract
  Enterprise   Contract-defined exercise set, limits and support

Avoid encoding access only as "number of exercises". Use explicit
exercise IDs so plan contents are deterministic and auditable.

The SDK should expose locked exercises in the catalogue when
appropriate, but must prevent session creation for an unlicensed
exercise.

Example:

``` ts
type EntitlementState = 'included' | 'locked';

interface ExerciseSummary {
  id: string;
  name: string;
  entitlement: EntitlementState;
}

const exercises = await FormCoach.getExercises();
// [{ id: 'squat', name: 'Squat', entitlement: 'included' },
//  { id: 'bicep_curl', name: 'Bicep curl', entitlement: 'locked' }]
```

`createSession({ exercise: 'bicep_curl' })` must fail with
`EXERCISE_NOT_LICENSED` when that exercise is not entitled.

### 6.6 Usage

Track coarse-grained usage, for example: - Session started/completed. -
Exercise ID and evaluator version. - Duration bucket. - SDK/platform
version. - App/environment ID. - Device performance bucket. - Optional
rep count if contract and privacy policy permit.

Do not send a usage event for every camera frame. Buffer and batch usage
events. Usage collection should be configurable and documented. Do not
include raw frames, images, face identity, or unnecessary personal data.

------------------------------------------------------------------------

## 7. System architecture

### 7.1 High-level architecture

``` text
                 CUSTOMER / DEVELOPER
                         |
                  Management Portal
                         |
                 HTTPS REST API
                         |
       +-----------------+-------------------+
       |                 |                   |
   Identity          Organisation        Catalogue /
   & RBAC            & Applications       Plans
       |                 |                   |
       +-----------------+-------------------+
                         |
                Licence / Entitlement
                         |
             Signed Entitlement Service
                         |
                 Usage & Audit Service
                         |
                    PostgreSQL


             CUSTOMER FITNESS APPLICATION
                         |
               FormCoach public SDK API
                         |
          +--------------+---------------+
          |                              |
     RN / Expo SDK                   Flutter SDK
          |                              |
          +--------------+---------------+
                         |
                 Native SDK Runtime
                 /               \
          Android Kotlin       iOS Swift
          CameraX              AVFoundation
                 \               /
                  Pose inference runtime
                         |
                  Pose landmarks
                         |
             Validation / smoothing
                         |
               Geometry measurements
                         |
              Exercise-specific evaluator
                         |
                Feedback and rep events
                         |
                Host app UI / storage
```

### 7.2 Core design decision: native frame processing

Camera frames are large and high frequency. Passing them through the
JavaScript bridge or Flutter platform channel creates copying, latency,
memory pressure and dropped frames.

Therefore: - Camera capture occurs natively. - Image preprocessing and
inference occur natively. - Landmarks and compact event payloads cross
the platform boundary. - UI overlays should use native rendering or
efficient renderer integration where possible. - JavaScript/Dart
controls session lifecycle and consumes events; it does not own the
real-time frame loop.

### 7.3 Recommended backend architecture

Start with a **modular monolith**, not microservices.

Suggested stack: - Node.js + TypeScript. - PostgreSQL. - REST API
described with OpenAPI. - Background job queue only when asynchronous
jobs are needed. - Object storage for documentation assets and approved
diagnostic bundles. - Managed secrets/KMS for signing keys. - Structured
logs, metrics and tracing.

Suggested backend modules: - Identity and authentication. -
Organisations and membership. - Applications and environments. -
Exercise catalogue. - Plans and subscriptions. - Licences and
entitlements. - Signing and key rotation. - Usage ingestion and
aggregation. - Audit. - Billing adapter. - Support/admin operations.

Keep module boundaries explicit so high-volume or independently operated
modules can be extracted later if necessary.

------------------------------------------------------------------------

## 8. Mobile SDK architecture

### 8.1 Package and artifact distribution

Proposed public packages:

  Platform                          Distribution
  --------------------------------- --------------------------------------------------------------
  React Native                      `@formcoach/react-native` on npm
  Expo                              `@formcoach/expo` config plugin / integration package on npm
  Shared TypeScript contracts       `@formcoach/types`
  Shared portable evaluator logic   `@formcoach/core` where practical
  Android                           Maven artifact, e.g. `com.formcoach:formcoach-android`
  iOS                               Swift Package Manager package `FormCoachSDK`
  Flutter                           `formcoach_flutter` on pub.dev

An npm package alone cannot provide native camera and inference
functionality on Android and iOS. The React Native package must depend
on native Android/iOS implementations.

### 8.2 React Native

-   Provide a typed TypeScript facade.
-   Implement native module using the supported React Native native
    module architecture.
-   Support the New Architecture as a release requirement; document any
    legacy architecture compatibility separately.
-   Provide a camera preview component.
-   Provide typed event subscriptions.
-   Do not send image buffers to JS.
-   Validate lifecycle under app backgrounding, navigation changes and
    permission changes.

### 8.3 Expo

-   Provide an Expo config plugin that installs native dependencies and
    applies required configuration.
-   Support Expo development builds / prebuild workflow.
-   Document that Expo Go is not supported unless proven otherwise; Expo
    Go cannot load arbitrary custom native modules.
-   Test clean prebuild, EAS Build and local development builds.
-   Document required iOS usage-description strings and Android
    permissions.

### 8.4 Android

-   Kotlin implementation.
-   CameraX for camera lifecycle and frame acquisition.
-   On-device inference runtime selected after model and licence
    evaluation.
-   Background processing on dedicated executors; avoid blocking main
    thread.
-   Handle camera permission, rotation, front-camera mirroring,
    lifecycle, thermal state and device capability.
-   Release camera, model and native buffers deterministically.
-   Publish a Maven artifact with documented minimum SDK and ABI
    support.

### 8.5 iOS

-   Swift implementation.
-   AVFoundation for camera capture.
-   On-device inference runtime selected after proof of concept.
-   Use appropriate pixel buffer / image processing paths to avoid
    unnecessary copies.
-   Handle camera permission, orientation, mirroring, interruptions, app
    lifecycle and thermal state.
-   Release capture session and model resources deterministically.
-   Distribute through Swift Package Manager.

### 8.6 Flutter

-   Dart public API.
-   Native Android Kotlin and iOS Swift implementation.
-   Platform view or texture for camera preview.
-   Method channels for commands and event channels for events, or a
    Pigeon-generated contract.
-   Do not transfer raw frame buffers over method channels.
-   Publish plugin to pub.dev with minimum Flutter/Dart and platform
    versions documented.

### 8.7 Shared versus platform-specific code

Share: - Public types and event contracts. - Exercise IDs and catalogue
schema. - Geometry utilities when numerically consistent. - Exercise
definitions/rules where portability is proven. - Entitlement token
schema and verification test vectors. - Conformance tests and recorded
pose fixtures.

Keep native: - Camera capture. - Frame conversion and preprocessing. -
Inference runtime and hardware delegates. - Threading, memory and
lifecycle. - Native rendering optimisations. - Platform permission
handling.

Do not force all code into TypeScript if doing so harms native real-time
performance. Deterministic evaluator logic may be shared only after
profiling and cross-platform numeric consistency tests.

------------------------------------------------------------------------

## 9. Public SDK API

The following is a proposed API contract. Exact naming can be refined
before the first public release, but the lifecycle and error semantics
should remain stable.

### 9.1 Initialisation

``` ts
import { FormCoach } from '@formcoach/react-native';

await FormCoach.initialize({
  appId: 'public_app_identifier',
  environment: 'production',
  inference: {
    targetFps: 24,
    processingResolution: '720p',
  },
  privacy: {
    processLocally: true,
    uploadVideo: false,
    collectUsage: true,
  },
});
```

Initialisation should: - Validate configuration. - Load the supported
model/runtime. - Load cached entitlement. - Verify entitlement signature
and expiry. - Prepare native runtime resources. - Return a clear status
or typed error.

The SDK must not silently upload video. `uploadVideo` should default to
false and should not be enabled in the first release.

### 9.2 Catalogue

``` ts
const exercises = await FormCoach.getExercises();

const details = await FormCoach.getExerciseDetails('squat');
```

Catalogue responses should include: - ID and display name. - Entitlement
state. - Supported view requirements. - Minimum SDK version. - Evaluator
version where safe to expose. - Limitations and setup guidance.

### 9.3 Session creation

``` ts
const session = await FormCoach.createSession({
  exercise: 'squat',
  camera: {
    facing: 'back',
  },
  subject: {
    requiredView: 'side',
  },
  feedback: {
    visual: true,
    voice: false,
    haptic: true,
  },
});
```

Important distinction: - `camera.facing` is the physical phone camera:
`front` or `back`. - `subject.requiredView` is the person's orientation
relative to the camera: `front`, `side` or `back`.

These are different concepts and must not be conflated.

### 9.4 Session lifecycle

``` ts
await session.start();
await session.pause();
await session.resume();
const summary = await session.stop();
await session.dispose();
```

Lifecycle requirements: - `start` is valid only from a created or paused
state. - `pause` is idempotent or returns a documented state error. -
`resume` revalidates camera and tracking state. - `stop` returns a final
summary. - `dispose` releases all native resources and listeners. - A
disposed session cannot be restarted.

### 9.5 React component

``` tsx
<FormCoachCamera
  session={session}
  showSkeleton
  showLandmarks={false}
  style={{ flex: 1 }}
/>
```

The component should: - Render the camera preview. - Respect layout and
orientation. - Optionally render skeleton/landmarks. - Avoid exposing
raw camera frames to JavaScript. - Clean up view resources when
unmounted without accidentally leaking or prematurely disposing a
session owned by the caller.

### 9.6 Events

``` ts
session.on('repCompleted', event => {
  console.log(event.repCount);
});

session.on('formIssue', event => {
  console.log(event.issueId, event.message);
});

session.on('trackingUpdate', event => {
  console.log(event.status);
});
```

Proposed events: - `ready` - `trackingUpdate` - `trackingLost` -
`calibrationRequired` - `calibrationCompleted` - `phaseChanged` -
`repCompleted` - `formIssue` - `feedback` - `performance` -
`sessionCompleted` - `error`

Every event should include a timestamp and session ID. Events that
describe exercise evaluation should include evaluator version and
confidence metadata where relevant.

### 9.7 Status and metrics

``` ts
const status = await session.getStatus();
const metrics = await session.getMetrics();
```

Tracking status: - `ready` - `tracking` - `partial` - `lost` -
`calibrating`

Assessment status: - `valid` - `insufficient_data` - `not_evaluated`

Do not collapse tracking and assessment into one boolean. A person can
be visible while a particular form rule is not assessable.

### 9.8 TypeScript contracts

``` ts
export type CameraFacing = 'front' | 'back';
export type BodyView = 'front' | 'side' | 'back';

export type TrackingStatus =
  | 'ready'
  | 'tracking'
  | 'partial'
  | 'lost'
  | 'calibrating';

export type AssessmentStatus =
  | 'valid'
  | 'insufficient_data'
  | 'not_evaluated';

export interface PosePoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

export interface TrackingUpdateEvent {
  sessionId: string;
  timestampMs: number;
  status: TrackingStatus;
  visibleLandmarkCount: number;
}

export interface RepCompletedEvent {
  sessionId: string;
  timestampMs: number;
  exerciseId: string;
  repCount: number;
  durationMs?: number;
  quality?: 'valid' | 'not_evaluated';
}

export interface FormIssueEvent {
  sessionId: string;
  timestampMs: number;
  exerciseId: string;
  issueId: string;
  severity: 'info' | 'warning';
  message: string;
  assessment: AssessmentStatus;
  confidence: number;
}
```

Avoid `any` in public types. Public API types must be versioned and
tested for source compatibility.

### 9.9 Error codes

  -----------------------------------------------------------------------
  Code                                Meaning
  ----------------------------------- -----------------------------------
  `SDK_NOT_INITIALIZED`               SDK used before initialisation

  `UNSUPPORTED_PLATFORM`              Platform or device is not supported

  `CAMERA_PERMISSION_DENIED`          User denied camera permission

  `CAMERA_IN_USE`                     Camera cannot be acquired

  `MODEL_LOAD_FAILED`                 Model/runtime failed to load

  `EXERCISE_NOT_FOUND`                Unknown exercise ID

  `EXERCISE_NOT_LICENSED`             Exercise not included in
                                      entitlement

  `LICENCE_EXPIRED`                   Entitlement expired

  `LICENCE_INVALID`                   Entitlement signature or claims
                                      invalid

  `LICENCE_REFRESH_REQUIRED`          Cached entitlement outside allowed
                                      grace

  `SESSION_INVALID_STATE`             Operation invalid for current
                                      session state

  `TRACKING_UNAVAILABLE`              Tracking cannot be established

  `INSUFFICIENT_DATA`                 Required pose data is unavailable

  `RESOURCE_DISPOSED`                 Operation attempted after disposal

  `INTERNAL_ERROR`                    Unexpected SDK error
  -----------------------------------------------------------------------

Errors should contain a stable code, safe human-readable message,
recoverability flag and optional diagnostic ID. Do not expose secrets,
raw frames or sensitive device data in error payloads.

------------------------------------------------------------------------

## 10. Exercise intelligence pipeline

### 10.1 Processing pipeline

``` text
Native camera
  -> frame acquisition and throttling
  -> image orientation / mirroring / preprocessing
  -> on-device pose inference
  -> landmarks + timestamp + confidence
  -> coordinate transform
  -> landmark validation
  -> temporal smoothing
  -> geometry measurements
  -> exercise-specific state machine
  -> form-rule evaluation
  -> confidence / abstention gate
  -> feedback priority and cooldown
  -> UI / voice / haptic events
  -> session summary
```

### 10.2 Pose estimation

Evaluate a model such as MediaPipe Pose Landmarker as an initial
candidate. Before shipping: - Verify current model and runtime licensing
and redistribution conditions. - Benchmark on supported devices. - Check
landmark quality across body sizes, clothing, lighting and camera
placement. - Test occlusion and partial visibility. - Verify Android and
iOS output consistency. - Decide whether hardware acceleration is
available and stable.

Pose estimation returns landmarks; it does not understand whether a
squat or push-up is correct. Exercise interpretation is a separate
layer.

### 10.3 Coordinate systems

Define a single internal coordinate convention: - Normalised image
coordinates. - Explicit image width and height. - Explicit rotation and
mirroring metadata. - Documented coordinate origin and axis direction.

Camera preview mirroring and inference coordinates must be reconciled.
Otherwise the overlay may look correct while left/right rules are
reversed.

2D image coordinates are not true 3D anatomical measurements.
Perspective, camera angle and depth can change apparent joint angles.
Every evaluator must declare which views support each measurement.

### 10.4 Landmark validation and smoothing

Before evaluating form: - Check required landmarks exist. - Check
visibility/presence confidence. - Reject impossible jumps or stale
timestamps. - Check person tracking identity remains stable. - Detect
partial body visibility. - Smooth noisy measurements over time.

A One Euro filter is a candidate for adaptive smoothing. A moving
average may be used for a simple prototype. Smoothing must not introduce
so much delay that rep transitions or feedback become late.

### 10.5 Geometry

Example 2D joint-angle calculation:

``` ts
type Point = { x: number; y: number };

function calculateAngle(a: Point, b: Point, c: Point): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };

  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.hypot(ba.x, ba.y);
  const magBC = Math.hypot(bc.x, bc.y);

  if (magBA === 0 || magBC === 0) return Number.NaN;

  const cosine = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosine) * (180 / Math.PI);
}
```

Measurements can include: - Joint angles. - Segment inclination. -
Relative distances normalised by body scale. - Left/right symmetry. -
Torso-to-leg relationships. - Temporal velocity and range of motion.

Every metric must define its landmarks, coordinate assumptions, units,
valid views and invalid-data behaviour.

### 10.6 Exercise evaluator contract

``` ts
interface ExerciseEvaluator<Input, Output> {
  readonly id: string;
  readonly version: string;

  validateConfiguration(config: unknown): ValidationResult;
  calibrate(input: Input): CalibrationResult;
  update(input: Input): Output;
  reset(): void;
  getMetrics(): ExerciseMetrics;
}
```

An evaluator should be deterministic for the same input sequence and
configuration. It must not depend on UI rendering or network access.

### 10.7 State machine and repetition counting

A repetition is a complete movement cycle, not a single threshold
crossing.

Example generic state model:

``` text
START
  -> READY
  -> DESCENDING
  -> BOTTOM
  -> ASCENDING
  -> COMPLETED (increment rep)
  -> READY
```

Each exercise defines its own phases and transitions. Use: - Entry and
exit thresholds (hysteresis). - Minimum phase duration. - Valid
transition ordering. - Reset conditions. - Tracking-loss handling. -
Cooldowns to avoid duplicate counts.

Do not count a rep if the required movement sequence was not completed
or tracking was lost during a critical phase.

### 10.8 Form rules and feedback

A form rule should declare: - Stable issue ID. - Required landmarks and
body view. - Measurement formula. - Threshold or classifier version. -
Minimum confidence. - Persistence duration. - Severity. - Feedback
message. - Cooldown and suppression rules. - Conditions that make the
rule not assessable.

Use confidence and persistence gates. A single noisy frame should not
trigger a strong warning. Prioritise precision over recall in the first
release to reduce false alerts.

Feedback priority example: 1. Tracking/setup issue. 2. Safety-relevant
but non-medical technique cue. 3. Main form cue. 4. Encouragement.

Do not show multiple contradictory cues simultaneously. Avoid
overwhelming the exerciser with repeated alerts.

### 10.9 Abstention

When data is unreliable, emit `insufficient_data` or `not_evaluated`,
not a guessed form score.

Examples: - Required knee landmark occluded. - Person outside frame. -
Required body view not satisfied. - Camera moved during a repetition. -
Landmark confidence below validated threshold. - Pose model tracking
switched to another person.

The host app should be able to explain the reason: "Move farther back",
"Keep your full body in frame", or "Position the camera to your side".

------------------------------------------------------------------------

## 11. Entitlement security and offline operation

### 11.1 Credential types

Keep these concepts separate:

1.  **Public app ID** --- identifies the customer app/environment; not
    secret.
2.  **Management API credential** --- server-side credential used by
    customer backend for privileged operations; never embed in a mobile
    binary.
3.  **Mobile app identifier/key** --- identifies the SDK integration;
    assume extractable and do not treat it as a secret.
4.  **Signed entitlement token** --- server-issued, time-bounded claims
    describing allowed exercises and policy.

### 11.2 Signed entitlement flow

1.  Customer creates an app and licence in the portal.
2.  Backend resolves plan and explicit exercise IDs.
3.  Entitlement service creates claims.
4.  Server signs the token with a private asymmetric signing key
    protected by KMS/HSM or equivalent.
5.  SDK downloads the token over TLS.
6.  SDK verifies the signature using the embedded public key.
7.  SDK checks issuer, audience, app ID, environment, issue time,
    expiry, token version and exercise claims.
8.  SDK caches the verified token securely.
9.  SDK checks entitlement locally when a session is created.

The private signing key must never be included in an SDK, sample app or
customer app. Support key IDs (`kid`) and planned public-key rotation.

### 11.3 Example entitlement claims

``` json
{
  "iss": "https://api.formcoach.example",
  "aud": "formcoach-sdk",
  "sub": "application_123",
  "environment": "production",
  "licenceId": "licence_456",
  "entitlementVersion": 12,
  "exercises": ["squat", "push_up", "lunge"],
  "issuedAt": 1794744000,
  "expiresAt": 1797336000,
  "offlineGraceUntil": 1797422400,
  "keyId": "entitlement-key-2026-01"
}
```

This is an illustrative schema. Use a well-reviewed standard such as
JWS/JWT with an approved asymmetric algorithm and strict claim
validation. Do not invent a custom cryptographic scheme.

### 11.4 Offline policy

-   SDK uses the last valid signed entitlement while offline.
-   Entitlement has an explicit expiry and optional grace deadline.
-   SDK refreshes at app launch and according to a configurable
    interval.
-   No backend call occurs for each frame, rep or feedback event.
-   When grace expires, apply a documented policy: block new licensed
    sessions or fall back to included free exercises, depending on
    contract.
-   An offline device cannot learn about immediate revocation until it
    reconnects. Explain this limitation to customers.
-   Never claim client-side licensing is impossible to bypass on a
    customer-controlled device. Signed tokens deter casual tampering but
    are not absolute DRM.

### 11.5 Refresh API

Example:

``` http
POST /v1/sdk/entitlements/refresh
Authorization: Bearer <short-lived-sdk-session-token>
Content-Type: application/json

{
  "applicationId": "application_123",
  "environment": "production",
  "sdkVersion": "1.0.0",
  "platform": "ios"
}
```

Return a signed entitlement plus cache and refresh metadata. Rate-limit
and authenticate appropriately. The exact client bootstrap must not
require a long-lived secret embedded in the mobile binary.

------------------------------------------------------------------------

## 12. Backend API design

All endpoints are versioned under `/v1`. Use consistent pagination,
error responses, idempotency where needed, request IDs and OpenAPI
documentation.

### 12.1 Identity and organisations

``` text
POST   /v1/auth/signup
POST   /v1/auth/login
POST   /v1/auth/logout
POST   /v1/auth/password/reset
GET    /v1/me

POST   /v1/organisations
GET    /v1/organisations
GET    /v1/organisations/{organisationId}
PATCH  /v1/organisations/{organisationId}

GET    /v1/organisations/{organisationId}/members
POST   /v1/organisations/{organisationId}/invitations
PATCH  /v1/organisations/{organisationId}/members/{memberId}
DELETE /v1/organisations/{organisationId}/members/{memberId}
```

### 12.2 Applications and environments

``` text
POST   /v1/organisations/{organisationId}/applications
GET    /v1/organisations/{organisationId}/applications
GET    /v1/applications/{applicationId}
PATCH  /v1/applications/{applicationId}

POST   /v1/applications/{applicationId}/environments
GET    /v1/applications/{applicationId}/environments
PATCH  /v1/environments/{environmentId}
POST   /v1/environments/{environmentId}/rotate-credential
```

### 12.3 Plans, licences and exercises

``` text
GET    /v1/exercises
GET    /v1/exercises/{exerciseId}
GET    /v1/plans
GET    /v1/plans/{planId}

POST   /v1/organisations/{organisationId}/licences
GET    /v1/organisations/{organisationId}/licences
GET    /v1/licences/{licenceId}
PATCH  /v1/licences/{licenceId}
POST   /v1/licences/{licenceId}/revoke
POST   /v1/licences/{licenceId}/reissue-entitlement
```

### 12.4 SDK endpoints

``` text
POST   /v1/sdk/bootstrap
POST   /v1/sdk/entitlements/refresh
POST   /v1/sdk/usage/batch
GET    /v1/sdk/status
```

### 12.5 Usage and audit

``` text
GET    /v1/organisations/{organisationId}/usage
GET    /v1/applications/{applicationId}/usage
GET    /v1/organisations/{organisationId}/audit-logs
```

### 12.6 API conventions

-   Use UTC timestamps in API payloads.
-   Use ISO 8601 strings for human-facing timestamps.
-   Use opaque IDs, not sequential database IDs.
-   Validate all request bodies with schemas.
-   Enforce tenant scoping on every organisation-owned resource.
-   Use cursor pagination for high-volume lists.
-   Add idempotency keys for licence creation, billing operations and
    batch ingestion where retries can duplicate effects.
-   Return stable machine-readable error codes.
-   Avoid leaking whether another tenant's resource exists.

------------------------------------------------------------------------

## 13. Data model

A proposed relational schema:

### 13.1 Tables

**users** - `id` - `email` (unique, normalised) - `password_hash` or
external identity provider subject - `status` - `created_at` -
`updated_at`

**organisations** - `id` - `name` - `slug` - `status` - `created_at` -
`updated_at`

**organisation_members** - `id` - `organisation_id` - `user_id` -
`role` - `status` - `created_at`

Unique constraint on `(organisation_id, user_id)`.

**invitations** - `id` - `organisation_id` - `email` - `role` -
`token_hash` - `expires_at` - `accepted_at` - `created_by`

**applications** - `id` - `organisation_id` - `name` - `platforms` -
`status` - `created_at`

**application_environments** - `id` - `application_id` - `name` -
`public_identifier` - `status` - `created_at`

Unique constraint on `(application_id, name)`.

**plans** - `id` - `name` - `code` - `status` - `billing_period` -
`created_at`

**plan_exercises** - `plan_id` - `exercise_id` -
`exercise_version_policy`

**exercises** - `id` - `name` - `description` - `publication_status` -
`current_version` - `supported_platforms` - `supported_views` -
`created_at`

**exercise_versions** - `id` - `exercise_id` - `version` -
`evaluator_version` - `model_compatibility` - `configuration` -
`validation_report` - `published_at`

**licences** - `id` - `organisation_id` - `application_id` (nullable if
org-wide) - `plan_id` - `status` - `starts_at` - `expires_at` -
`offline_grace_seconds` - `created_at` - `updated_at`

**licence_exercise_overrides** - `licence_id` - `exercise_id` - `access`
(`include` / `exclude`)

**entitlement_issues** - `id` - `licence_id` - `entitlement_version` -
`key_id` - `issued_at` - `expires_at` - `revoked_at` - `claims_hash`

Do not store private signing keys in this table.

**usage_events** - `id` - `organisation_id` - `application_id` -
`environment_id` - `event_type` - `exercise_id` - `sdk_version` -
`platform` - `event_timestamp` - `received_at` - `metadata` (strictly
allow-listed JSON)

**audit_logs** - `id` - `actor_user_id` - `organisation_id` - `action` -
`resource_type` - `resource_id` - `request_id` - `created_at` -
`metadata`

### 13.2 Data integrity

-   Foreign keys for tenant-owned relationships.
-   Unique constraints for membership, environment names and external
    identifiers.
-   Index all tenant filters and common dashboard dimensions.
-   Use transactions for plan/licence changes and entitlement version
    increments.
-   Audit all privilege, licence, credential and publication changes.
-   Define retention policies for usage and audit data.
-   Avoid storing unnecessary exerciser personal data.

------------------------------------------------------------------------

## 14. Security, privacy and safety

### 14.1 Privacy defaults

-   Camera permission requested by the host app at the point of use.
-   Clear user-facing explanation of why camera access is needed.
-   On-device processing by default.
-   No continuous video upload.
-   No face recognition or identity matching.
-   No raw frame logging.
-   No camera data in crash reports.
-   Usage telemetry minimised and configurable.
-   Host app controls workout history and end-user identity.

If future cloud processing is introduced, it requires a separate privacy
review, explicit product consent, data retention policy, security
controls and customer contract updates.

### 14.2 Security

-   TLS for all network communication.
-   Secure password storage or trusted identity provider.
-   Short-lived access tokens and refresh-token rotation.
-   Server-side tenant and role enforcement.
-   KMS/HSM-backed signing key protection.
-   Key IDs and public-key rotation.
-   Rate limiting and abuse protection.
-   Input validation and output encoding.
-   Dependency and native binary scanning.
-   Signed release artifacts and protected CI/CD.
-   Audit trail for sensitive admin actions.
-   No server credentials in mobile packages.

### 14.3 Safety language

FormCoach provides exercise technique cues based on camera-derived
estimates. It does not diagnose injury, assess medical fitness,
guarantee injury prevention or replace professional coaching or medical
advice.

When the system cannot confidently evaluate a movement, it should say
that tracking is insufficient rather than inventing a correction.
Feedback should use neutral coaching language and avoid medical claims.

------------------------------------------------------------------------

## 15. Performance and reliability requirements

Initial engineering targets to validate on the device matrix:

  -----------------------------------------------------------------------
  Area                                Proposed target
  ----------------------------------- -----------------------------------
  Inference cadence                   Target 20--30 FPS on supported
                                      mid/high-tier devices; degrade
                                      gracefully

  Feedback latency                    Aim for under 250 ms from usable
                                      frame to emitted feedback

  Camera preview                      Remain responsive while inference
                                      runs

  Memory                              No unbounded frame or landmark
                                      queues

  Lifecycle                           Release camera and model resources
                                      on stop/dispose

  Thermal                             Reduce inference cadence or
                                      resolution when sustained thermal
                                      pressure occurs

  Network                             Workout and evaluation continue
                                      offline with valid entitlement

  Startup                             Measure cold and warm
                                      initialisation separately
  -----------------------------------------------------------------------

Do not make one performance target apply to every device. Publish a
minimum supported device matrix and report measured results by
platform/device class.

### 15.1 Frame scheduling

-   Use a bounded frame queue, ideally latest-frame-wins for real-time
    feedback.
-   Drop stale frames rather than allowing latency to grow.
-   Avoid processing multiple frames concurrently unless the inference
    runtime and evaluator are designed for it.
-   Timestamp frames at capture.
-   Measure camera-to-inference, inference, evaluator and event-delivery
    latency separately.

### 15.2 Graceful degradation

When performance drops: 1. Reduce inference cadence. 2. Reduce
processing resolution if supported. 3. Disable optional overlay detail.
4. Inform the host app if tracking quality is affected. 5. Never
silently emit stale feedback as if it were current.

------------------------------------------------------------------------

## 16. Observability and diagnostics

### 16.1 SDK metrics

-   SDK initialisation duration.
-   Model load duration.
-   Camera startup duration.
-   Inference latency percentiles.
-   Effective processing FPS.
-   Dropped frame count.
-   Tracking-loss duration.
-   Session duration.
-   Evaluator processing time.
-   Memory and thermal state buckets.
-   Error counts by stable error code.

### 16.2 Backend metrics

-   API latency and error rate.
-   Authentication failures.
-   Entitlement issuance/refresh success.
-   Invalid signature attempts.
-   Usage ingestion lag and rejection rate.
-   Licence state transitions.
-   Portal activity.
-   Database health and connection pool saturation.

### 16.3 Diagnostics privacy

Diagnostic bundles must exclude raw video and images by default. Include
SDK version, platform version, error code, timing summaries and
non-identifying configuration. Any optional user-submitted media
requires explicit consent and a documented secure handling process.

------------------------------------------------------------------------

## 17. Testing and validation

### 17.1 Unit tests

-   Geometry functions and edge cases.
-   Smoothing and confidence filters.
-   Exercise state machines.
-   Rep counting.
-   Form-rule persistence and cooldown.
-   Entitlement parsing and signature verification.
-   Expiry and offline-grace logic.
-   API validation and RBAC.

### 17.2 Recorded fixture tests

Create versioned, consented pose-landmark sequences with expected
outputs. Replay the same fixtures on Android, iOS and portable evaluator
implementations to detect regressions.

Fixtures should include: - Correct repetitions. - Incomplete
repetitions. - Slow and fast repetitions. - Pauses at movement phases. -
Occlusion. - Out-of-frame movement. - Tracking loss and reacquisition. -
Different body proportions and clothing. - Camera angle variations.

### 17.3 Integration tests

-   Camera permission granted/denied/revoked.
-   App background and foreground.
-   Incoming call or camera interruption.
-   Rotation and mirroring.
-   Session pause/resume/stop/dispose.
-   Offline entitlement use.
-   Expired entitlement.
-   Plan upgrade and refresh.
-   Invalid token and unknown key ID.
-   SDK upgrade and downgrade compatibility.

### 17.4 Exercise validation protocol

For each exercise: 1. Define supported views and test protocol. 2.
Collect consented recordings or pose data under controlled conditions.
3. Have qualified reviewers annotate movement phases and target form
issues. 4. Split validation data by participant, not by adjacent frames,
to reduce leakage. 5. Measure rep-count precision, recall and absolute
count error. 6. Measure form-rule precision, recall and false alerts per
minute/session. 7. Measure abstention rate and whether abstention occurs
in genuinely unobservable cases. 8. Review failures by device, lighting,
body view and occlusion. 9. Publish only after acceptance thresholds are
met. 10. Revalidate after model, evaluator or threshold changes.

Do not claim a universal "form accuracy" percentage. Report exercise-
and view-specific measurements with dataset limitations.

### 17.5 Release gates

-   No P0 security issues.
-   No unresolved camera/resource leaks.
-   Public API contract tests pass.
-   Supported device matrix passes.
-   Entitlement verification test vectors pass on every platform.
-   Exercise validation report approved.
-   Privacy and model licence review complete.
-   Documentation and migration notes published.

------------------------------------------------------------------------

## 18. Repository and code organisation

Suggested monorepo:

``` text
formcoach/
├── apps/
│   ├── portal/                 # Customer and internal management web app
│   ├── api/                    # Node.js TypeScript backend
│   ├── docs/                   # SDK documentation
│   ├── demo-react-native/
│   ├── demo-expo/
│   ├── demo-android/
│   ├── demo-ios/
│   └── demo-flutter/
├── packages/
│   ├── types/                  # Shared public contracts
│   ├── core/                   # Portable logic where appropriate
│   ├── react-native/           # RN facade and components
│   ├── expo/                   # Expo config plugin
│   ├── web-client/             # Optional typed portal/API client
│   └── exercise-definitions/   # Versioned evaluator metadata
├── native/
│   ├── android/
│   ├── ios/
│   └── flutter/
├── exercises/
│   ├── squat/
│   ├── push-up/
│   └── lunge/
├── models/
│   ├── manifests/
│   └── evaluation/
├── contracts/
│   ├── events/
│   ├── entitlement/
│   └── fixtures/
├── infrastructure/
│   ├── deployment/
│   ├── database/
│   └── monitoring/
└── docs/
    ├── architecture/
    ├── security/
    └── exercise-validation/
```

### 18.1 Build and release

-   Pin toolchains and native dependencies.
-   Use reproducible CI builds where possible.
-   Run TypeScript, Kotlin, Swift, Dart and backend checks.
-   Run contract tests across all platform bindings.
-   Publish packages with semantic versioning.
-   Maintain release notes and migration guides.
-   Use staged releases and a rollback process.
-   Keep model/evaluator versions independently identifiable from SDK
    package versions.

------------------------------------------------------------------------

## 19. Versioning and compatibility

There are multiple independently versioned components:

-   Public SDK API version.
-   Android native runtime version.
-   iOS native runtime version.
-   Flutter plugin version.
-   Pose model version.
-   Exercise evaluator version.
-   Entitlement schema version.

A model update must not silently change an exercise's behaviour without
validation. An exercise version should identify the actual rules and
calibration behaviour used for a session summary.

Compatibility metadata should allow the backend to issue only exercise
versions supported by a customer's SDK version.

Use semantic versioning: - Major: breaking public API changes. - Minor:
backward-compatible functionality. - Patch: backward-compatible fixes.

------------------------------------------------------------------------

## 20. Portal and API non-functional requirements

-   Responsive portal for desktop and tablet.
-   Accessible forms, tables and navigation.
-   Tenant data isolation.
-   Backend-authoritative permissions.
-   Database backups and tested restore procedure.
-   Rate limits and abuse controls.
-   Auditability for billing/licence/role changes.
-   Operational dashboards and alerts.
-   Documented support and incident process.
-   Data export and account deletion workflow aligned with contract and
    applicable law.

------------------------------------------------------------------------

## 21. Deployment and environments

Maintain separate environments: - Local development. - Shared
development. - Staging. - Production.

Each environment should have separate: - Database. - Signing keys. - API
credentials. - App identifiers. - Observability projects. - Billing mode
and provider credentials.

Never use production signing keys in development. Use test entitlement
keys for local and staging SDK builds.

Suggested deployment: - Portal static/server-rendered web deployment. -
API container deployment. - Managed PostgreSQL. - Managed secret
store/KMS. - Object storage for non-sensitive assets. - Centralised
logs, metrics and alerts.

The exact cloud provider can be selected based on the team's existing
operational capability and cost requirements.

------------------------------------------------------------------------

## 22. Acceptance criteria for first commercial release

### Portal

-   A user can register and create an organisation.
-   An owner can invite a developer and analyst.
-   A developer can create an application and environments.
-   An owner can assign a plan/licence.
-   Portal displays included exercise IDs and licence status.
-   Licence changes are audited.
-   Admin can revoke and reissue entitlements.

### Backend

-   Tenant boundaries are enforced.
-   Licence and entitlement changes are transactional.
-   Signed entitlements are verified by all supported SDKs.
-   Signing private key is not present in application code or SDK
    artifacts.
-   Usage batches are authenticated, validated and idempotently handled.
-   API documentation is published.

### SDK

-   Initialises on supported Android and iOS devices.
-   Runs camera and pose inference on-device.
-   Supports session lifecycle and typed events.
-   Runs at least the initial published exercises.
-   Does not upload video by default.
-   Supports cached entitlement and documented offline grace.
-   Emits stable error codes.
-   Releases camera and inference resources reliably.

### Cross-platform

-   React Native demo app passes the supported device matrix.
-   Expo custom development build works from a clean prebuild.
-   Native Android sample works.
-   Native iOS sample works.
-   Flutter sample works.
-   All platforms pass entitlement and event contract tests.

### Exercise quality

-   Each published exercise has a validation report.
-   Rep counting has measured precision/recall.
-   Form feedback has measured false-alert rate.
-   Required view and limitations are documented.
-   Insufficient tracking produces abstention rather than fabricated
    feedback.

------------------------------------------------------------------------

## 23. Key risks and mitigations

  -----------------------------------------------------------------------
  Risk                    Impact                  Mitigation
  ----------------------- ----------------------- -----------------------
  Pose model performs     Poor user experience    Device matrix,
  inconsistently across                           confidence gates, model
  devices                                         benchmarking

  2D geometry mistaken    Incorrect cues          View-specific rules,
  for 3D biomechanics                             limitations,
                                                  conservative claims

  False-positive form     Loss of trust           High precision
  feedback                                        thresholds, persistence
                                                  and abstention

  Native integration      Delayed cross-platform  Prove Android/iOS core
  complexity              launch                  first; shared contracts

  Expo Go expectation     Integration failure     Explicitly support
                                                  custom development
                                                  builds

  Frame bridge overhead   High latency and        Native frame pipeline
                          dropped frames          

  Offline revocation      Entitlement remains     Short validity, grace
  delay                   usable temporarily      policy, clear contracts

  Mobile licensing bypass Unauthorised feature    Signed entitlements,
                          use                     server controls,
                                                  realistic DRM
                                                  expectations

  Model licence           Legal/commercial risk   Review before
  incompatibility                                 redistribution

  Exercise catalogue      Quality regression      Publication checklist
  grows faster than                               and exercise versioning
  validation                                      

  Sensitive camera data   Privacy harm            On-device default, no
  leakage                                         raw frame
                                                  logging/upload
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 24. Open decisions before implementation

The following decisions require a technical spike or product-owner
approval:

1.  Exact pose model/runtime and its redistribution licence.
2.  Minimum Android API level, iOS deployment target and supported
    device matrix.
3.  React Native version range and New Architecture support policy.
4.  Whether Flutter and Expo ship in the first commercial release or a
    subsequent milestone.
5.  Exact initial exercise rules and supported camera views.
6.  Entitlement validity period and offline grace duration.
7.  Commercial billing provider and whether billing is self-serve or
    invoiced.
8.  Usage data retention and customer export policy.
9.  Whether the host app may supply its own camera frames in a future
    advanced API.
10. Whether exercise evaluator updates can be delivered independently
    from SDK releases, subject to security and compatibility
    constraints.

Do not begin by building every portal feature and every platform in
parallel. First prove the native camera + inference + one exercise
pipeline on Android and iOS. Then stabilise the shared contracts and
build wrappers. Build licensing and portal workflows once the SDK's
exercise catalogue and entitlement boundaries are clear.

------------------------------------------------------------------------

## 25. Recommended implementation sequence

### Sprint group A --- Feasibility

-   Create Android and iOS proof-of-concept apps.
-   Integrate candidate pose model.
-   Render landmarks.
-   Measure inference FPS and latency.
-   Test device rotation, mirroring and lifecycle.
-   Implement a replayable pose fixture harness.

### Sprint group B --- Exercise engine

-   Define coordinate and landmark contracts.
-   Implement geometry helpers.
-   Implement tracking confidence and smoothing.
-   Implement squat evaluator and state machine.
-   Add rep counting and conservative feedback.
-   Validate with annotated sessions.

### Sprint group C --- SDK contracts

-   Define public types and stable errors.
-   Implement native session lifecycle.
-   Implement RN facade and camera component.
-   Add events, status and metrics.
-   Build demo app and contract tests.

### Sprint group D --- Licensing backend

-   Implement users, organisations, apps and environments.
-   Implement plans, exercises and licences.
-   Implement signed entitlement issuance and verification.
-   Add offline caching and grace policy.
-   Add usage batch ingestion and audit events.

### Sprint group E --- Portal

-   Implement onboarding and team management.
-   Implement app/environment screens.
-   Implement licence and exercise entitlement screens.
-   Implement usage and audit views.
-   Add internal support/admin workflows.

### Sprint group F --- Platform expansion

-   Expo config plugin and custom build test matrix.
-   Flutter plugin and native bridges.
-   Native Android/iOS package distribution.
-   Documentation and sample apps.

### Sprint group G --- Commercial hardening

-   Security review and penetration testing.
-   Performance/thermal testing.
-   Exercise validation sign-off.
-   CI/CD and release automation.
-   Customer onboarding, support and operational runbooks.

------------------------------------------------------------------------

## 26. Glossary

  -----------------------------------------------------------------------
  Term                                Meaning
  ----------------------------------- -----------------------------------
  Pose estimation                     Detecting body landmarks from an
                                      image or video frame

  Landmark                            A detected body point such as
                                      shoulder, hip, knee or ankle

  Evaluator                           Exercise-specific logic that
                                      interprets a sequence of pose data

  Exercise phase                      A stage of a movement, such as
                                      descending or ascending

  Rep                                 A complete valid repetition cycle

  Calibration                         Establishing a usable starting
                                      position or body scale

  Abstention                          Explicitly declining to evaluate
                                      when evidence is insufficient

  Entitlement                         A signed set of permissions granted
                                      to an app/licence

  Licence                             Commercial record connecting a
                                      customer/app to a plan and access
                                      policy

  Offline grace                       Period during which a previously
                                      verified entitlement remains usable
                                      without refresh

  Evaluator version                   Version of exercise-specific logic
                                      used to produce results
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 27. Final architectural recommendation

Build FormCoach as a **native-first exercise intelligence runtime with
thin cross-platform SDK facades and a modular licensing backend**.

The critical product risk is not the portal or the subscription system.
It is whether the camera + pose model + exercise evaluator can produce
useful, low-latency and trustworthy feedback on real devices. Prove that
first with one exercise and a rigorous validation harness.

Once the native pipeline is proven: - Stabilise shared API contracts. -
Ship React Native and native SDKs. - Add Expo through a config plugin
and custom development builds. - Add Flutter through a Dart plugin
backed by the same native engines. - Build the portal and signed
entitlement service around explicit exercise IDs. - Expand the catalogue
only when each exercise has passed its own validation process.

This document is the baseline PRD/TDD. Product thresholds, supported
devices, legal terms, model choice and commercial policies must be
finalised through the feasibility and validation phases before public
launch.
