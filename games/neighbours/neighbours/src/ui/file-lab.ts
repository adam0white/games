import {
	createLab,
	type Lab,
	openSendDialog,
	privacySignal,
} from "@adam0white/lab-client";

/** A file page opens the Lab client only after an explicit send or recording action. */
export function fileLab(game: string): Lab {
	let active: Lab | undefined;
	let disposed = false;
	let recording = false;
	let persona: string | null = null;
	let personaAllowed = false;
	const tracks = new Set<{ start: (client: Lab) => void; stop?: () => void }>();
	const start = () => {
		if (disposed) throw new Error("This file session has closed.");
		if (!active) {
			active = createLab({
				game,
				preservation: "preserve",
				deferRecording: true,
			});
			active.setPersonaRecording(persona);
			if (personaAllowed) active.allowPersonaRecording(true);
		}
		return active;
	};
	const startTracks = (client: Lab) => {
		for (const track of tracks) if (!track.stop) track.start(client);
	};
	const facade: Lab = {
		game,
		endpoint: "",
		get preservationStatus() {
			return active?.preservationStatus ?? "standard";
		},
		get eventsOn() {
			return recording && (active?.eventsOn ?? false);
		},
		get telemetryOn() {
			return recording && (active?.telemetryOn ?? false);
		},
		get privacySignalOn() {
			return active?.privacySignalOn ?? privacySignal();
		},
		get privacyOverride() {
			return active?.privacyOverride ?? false;
		},
		get playerId() {
			return active?.playerId ?? null;
		},
		get personaRecordingAllowed() {
			return recording && (active?.personaRecordingAllowed ?? false);
		},
		dispose: () => {
			disposed = true;
			recording = false;
			for (const track of tracks) track.stop?.();
			tracks.clear();
			active?.dispose();
		},
		milestone: (name) => {
			if (recording) active?.milestone(name);
		},
		screen: (name) => {
			if (recording) active?.screen(name);
		},
		flush: () => {
			if (recording) active?.flush();
		},
		setEventsOff: (off) => {
			if (disposed) return;
			if (off) {
				recording = false;
				active?.setEventsOff(true);
				return;
			}
			const client = start();
			if (client.preservationStatus !== "existing-local") return;
			client.setEventsOff(false);
			recording = client.telemetryOn;
			if (recording) startTracks(client);
		},
		setPrivacyOverride: (allow) => {
			if (disposed) return;
			if (allow) start().setPrivacyOverride(allow);
			else active?.setPrivacyOverride(allow);
		},
		setTelemetryOff: (off) => {
			if (disposed) return;
			if (off) {
				recording = false;
				active?.setTelemetryOff(true);
				return;
			}
			const client = start();
			if (client.preservationStatus !== "existing-local") return;
			client.setTelemetryOff(false);
			recording = client.telemetryOn;
			if (recording) startTracks(client);
		},
		trackRun: (getRun, options) => {
			const track: { start: (client: Lab) => void; stop?: () => void } = {
				start: (client) => {
					track.stop = client.trackRun(getRun, options);
				},
			};
			if (!disposed) {
				tracks.add(track);
				if (recording && active) track.start(active);
			}
			return () => {
				track.stop?.();
				tracks.delete(track);
			};
		},
		captureSave: (value) => {
			if (recording) active?.captureSave(value);
		},
		log: (level, message) => {
			if (recording) active?.log(level, message);
		},
		setPersonaRecording: (key) => {
			if (disposed) return;
			persona = key;
			active?.setPersonaRecording(key);
		},
		allowPersonaRecording: (allow) => {
			if (disposed) return;
			personaAllowed = allow;
			active?.allowPersonaRecording(allow);
		},
		sendRun: (run, extra) => start().sendRun(run, extra),
		sendEnvelopeText: (value) => start().sendEnvelopeText(value),
		sendFeedback: (note, options) => {
			const client = start();
			if (
				options?.sharePlay &&
				client.preservationStatus === "existing-local"
			) {
				client.setTelemetryOff(false);
				recording = client.telemetryOn;
				if (recording) startTracks(client);
			}
			return client.sendFeedback(note, options);
		},
		openSendDialog: (options) => openSendDialog({ ...options, lab: facade }),
		build: () => active?.build() ?? {},
	};
	return facade;
}
