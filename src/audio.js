export function cueForUnit(type) {
  return (
    {
      soldier: "rifle",
      tank: "cannon",
      turret: "missile",
      fighter: "missile",
      bomber: "bomb",
      destroyer: "naval",
      submarine: "torpedo",
    }[type] || "order"
  );
}
export function loadSoundSettings(storage) {
  try {
    const value = JSON.parse(storage.getItem("myos-sound-v1"));
    return {
      volume: Number.isFinite(value?.volume)
        ? Math.max(0, Math.min(1, value.volume))
        : 0.45,
    };
  } catch {
    return { volume: 0.45 };
  }
}
// Layered, locally synthesized effects; no recordings, downloads or autoplay.
export function scheduleCue(ctx, name, destination, pan = 0) {
  const now = ctx.currentTime,
    nodes = [],
    sources = [];
  const output = ctx.createGain(),
    panner = ctx.createStereoPanner();
  output.gain.value = 0.55;
  panner.pan.value = Math.max(-0.8, Math.min(0.8, pan));
  output.connect(panner);
  panner.connect(destination);
  nodes.push(output, panner);
  let longest = 0.15;
  function tone(freq, end, duration, gain, wave = "sine", delay = 0) {
    const source = ctx.createOscillator(),
      envelope = ctx.createGain();
    source.type = wave;
    source.frequency.setValueAtTime(freq, now + delay);
    source.frequency.exponentialRampToValueAtTime(
      Math.max(1, end),
      now + delay + duration,
    );
    envelope.gain.setValueAtTime(0.0001, now + delay);
    envelope.gain.exponentialRampToValueAtTime(gain, now + delay + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
    source.connect(envelope);
    envelope.connect(output);
    source.start(now + delay);
    source.stop(now + delay + duration + 0.02);
    sources.push(source);
    nodes.push(envelope);
    longest = Math.max(longest, delay + duration);
  }
  function noise(duration, gain, frequency, filter = "lowpass") {
    const source = ctx.createBufferSource(),
      buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * duration),
        ctx.sampleRate,
      ),
      data = buffer.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
    source.buffer = buffer;
    const shaping = ctx.createBiquadFilter(),
      envelope = ctx.createGain();
    shaping.type = filter;
    shaping.frequency.value = frequency;
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(shaping);
    shaping.connect(envelope);
    envelope.connect(output);
    source.start(now);
    source.stop(now + duration + 0.02);
    sources.push(source);
    nodes.push(shaping, envelope);
    longest = Math.max(longest, duration);
  }
  switch (name) {
    case "rifle":
      noise(0.11, 0.36, 2400, "highpass");
      tone(140, 55, 0.09, 0.22, "triangle");
      break;
    case "cannon":
      noise(0.48, 0.65, 850);
      tone(105, 28, 0.42, 0.65);
      break;
    case "naval":
      noise(0.7, 0.6, 520);
      tone(78, 22, 0.65, 0.7);
      break;
    case "bomb":
      noise(0.9, 0.7, 420);
      tone(65, 18, 0.8, 0.65);
      break;
    case "explosion":
      noise(0.8, 0.7, 700);
      tone(90, 20, 0.65, 0.55);
      break;
    case "missile":
      noise(0.32, 0.3, 2200, "bandpass");
      tone(650, 120, 0.32, 0.18, "sawtooth");
      break;
    case "torpedo":
      noise(0.4, 0.2, 260);
      tone(230, 65, 0.45, 0.3);
      break;
    case "sonar":
      tone(880, 850, 0.85, 0.15);
      tone(880, 850, 0.5, 0.045, "sine", 0.25);
      break;
    case "wave":
      tone(380, 380, 0.2, 0.18, "triangle");
      tone(520, 520, 0.3, 0.18, "triangle", 0.25);
      break;
    case "victory":
      for (const [i, f] of [392, 494, 587, 784].entries())
        tone(f, f, 0.35, 0.16, "triangle", i * 0.14);
      break;
    case "defeat":
      tone(260, 130, 0.7, 0.16, "triangle");
      break;
    case "build":
    case "train":
      tone(520, 780, 0.16, 0.1, "triangle");
      tone(780, 980, 0.16, 0.1, "triangle", 0.12);
      break;
    default:
      tone(540, 700, 0.09, 0.09, "sine");
  }
  const cleanup = () => nodes.forEach((node) => node.disconnect());
  let ended = 0;
  for (const source of sources)
    source.onended = () => {
      source.disconnect();
      if (++ended === sources.length) cleanup();
    };
  return {
    duration: longest,
    stop() {
      for (const source of sources)
        try {
          source.stop();
        } catch {
          /* Already ended. */
        }
    },
  };
}
export class BattleAudio {
  constructor(storage) {
    this.storage = storage;
    this.volume = loadSoundSettings(storage).volume;
    this.enabled = false;
    this.context = null;
    this.active = false;
    this.ambient = null;
    this.lastCue = -Infinity;
    this.sonar = 0;
    this.voices = new Set();
    this.lastKind = "";
    this.terminalUntil = 0;
  }
  async enable() {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) throw Error("الصوت غير مدعوم في هذا المتصفح");
    if (!this.context) {
      this.context = new Context();
      this.master = this.context.createGain();
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.ratio.value = 6;
      this.master.connect(limiter);
      limiter.connect(this.context.destination);
      this.master.gain.value = 0;
    }
    await this.context.resume();
    if (this.context.state !== "running")
      throw Error("اضغط تشغيل الصوت مجددًا للسماح به");
    this.enabled = true;
  }
  mute() {
    this.enabled = false;
    this.setActive(false);
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    try {
      this.storage.setItem(
        "myos-sound-v1",
        JSON.stringify({ volume: this.volume }),
      );
    } catch {
      /* Sound remains usable without storage. */
    }
    if (this.context)
      this.master.gain.setTargetAtTime(
        this.active && this.enabled ? this.volume : 0,
        this.context.currentTime,
        0.03,
      );
  }
  setActive(active) {
    active = Boolean(active && this.enabled);
    if (this.active === active) return;
    this.active = active;
    if (this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      if (active) this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,0.04);
      else { this.master.gain.value=0;this.master.gain.setValueAtTime(0,this.context.currentTime); }
    }
    if (!active) {
      this.stopAmbient();
      for (const voice of this.voices) voice.stop();
      this.voices.clear();
    }
  }
  stopAmbient() {
    if (this.ambient) {
      this.ambient.source.stop();
      this.ambient.source.disconnect();
      this.ambient.filter.disconnect();
      this.ambient.gain.disconnect();
      this.ambient.motor.stop();
      this.ambient.motor.disconnect();
      this.ambient.motorGain.disconnect();
      this.ambient = null;
    }
  }
  ambience(kind, army) {
    if (!this.context || !this.active) return;
    if (this.lastKind !== kind) {
      this.stopAmbient();
      this.lastKind = kind;
      this.sonar = 0;
    }
    if (!this.ambient) {
      const ctx = this.context,
        source = ctx.createBufferSource(),
        buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      source.buffer = buffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      filter.type = "lowpass";
      filter.frequency.value =
        kind === "highland"
          ? 1100
          : kind === "abyss"
            ? 160
            : kind === "coast"
              ? 350
              : 500;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      gain.gain.value = 0.04;
      source.start();
      const motor = ctx.createOscillator(),
        motorGain = ctx.createGain();
      motor.type = "triangle";
      motor.frequency.value =
        kind === "highland"
          ? 115
          : kind === "coast"
            ? 48
            : kind === "abyss"
              ? 32
              : 42;
      motorGain.gain.value = 0.015;
      motor.connect(motorGain);
      motorGain.connect(this.master);
      motor.start();
      this.ambient = { source, filter, gain, motor, motorGain };
    }
    const aircraft = army.filter((e) => e.domain === "air").length;
    this.ambient.motorGain.gain.setTargetAtTime(
      Math.min(
        0.05,
        0.01 +
          army.filter((e) => e.speed && e.type !== "soldier").length * 0.003,
      ),
      this.context.currentTime,
      0.3,
    );
    this.ambient.gain.gain.setTargetAtTime(
      kind === "highland"
        ? 0.045 + Math.min(aircraft, 10) * 0.009
        : kind === "coast"
          ? 0.075
          : 0.035,
      this.context.currentTime,
      0.3,
    );
  }
  play(name, x = 500) {
    if (!this.active || !this.enabled || !this.context || this.volume === 0)
      return;
    const now = this.context.currentTime;
    const priority = ["victory", "defeat", "explosion", "wave"].includes(name);
    if ((now - this.lastCue < 0.025 && !priority) || this.voices.size >= 16)
      return;
    this.lastCue = now;
    const voice = scheduleCue(this.context, name, this.master, (x - 500) / 650);
    this.voices.add(voice);
    setTimeout(() => this.voices.delete(voice), (voice.duration + 0.1) * 1000);
  }
  update(battle, events, visible) {
    const final = events.find(
      (e) => e.kind === "victory" || e.kind === "defeat",
    );
    if (final && this.context)
      this.terminalUntil = this.context.currentTime + 1.3;
    this.setActive(
      visible &&
        !battle.paused &&
        (battle.status === "playing" ||
          Boolean(
            this.context && this.context.currentTime < this.terminalUntil,
          )),
    );
    if (!this.active) return;
    if (battle.status === "playing")
      this.ambience(battle.stage.terrain, battle.entities);
    else this.stopAmbient();
    if (battle.stage.terrain === "abyss" && battle.time - this.sonar > 6) {
      this.sonar = battle.time;
      this.play("sonar");
    }
    for (const event of events)
      this.play(
        event.kind === "shot" ? cueForUnit(event.type) : event.kind,
        event.x,
      );
  }
  async dispose() {
    this.mute();
    if (this.context && this.context.state !== "closed")
      await this.context.close();
  }
}
