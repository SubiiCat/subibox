// Copyright (C) 2020 John Nesky, distributed under the MIT license.

import {Dictionary, DictionaryArray, FilterType, EnvelopeType, InstrumentType, EffectType, Transition, Chord, Envelope, Config, getDrumWave, drawNoiseSpectrum, getArpeggioPitchIndex, performIntegral, getPulseWidthRatio, effectsIncludeDistortion, effectsIncludeBitcrusher, effectsIncludePanning, effectsIncludeChorus, effectsIncludeReverb} from "./SynthConfig";
import {scaleElementsByFactor, inverseRealFourierTransform} from "./FFT";
import {Deque} from "./Deque";
import {FilterCoefficients, FrequencyResponse, DynamicBiquadFilter} from "./filtering";

declare global {
	interface Window {
		AudioContext: any;
		webkitAudioContext: any;
	}
}

const epsilon: number = (1.0e-24); // For detecting and avoiding float denormals, which have poor performance.

//namespace beepbox {
	// For performance debugging:
	//let samplesAccumulated: number = 0;
	//let samplePerformance: number = 0;
	
	const enum CharCode {
		SPACE = 32,
		HASH = 35,
		PERCENT = 37,
		AMPERSAND = 38,
		PLUS = 43,
		DASH = 45,
		DOT = 46,
		NUM_0 = 48,
		NUM_1 = 49,
		NUM_2 = 50,
		NUM_3 = 51,
		NUM_4 = 52,
		NUM_5 = 53,
		NUM_6 = 54,
		NUM_7 = 55,
		NUM_8 = 56,
		NUM_9 = 57,
		EQUALS = 61,
		A =  65,
		B =  66,
		C =  67,
		D =  68,
		E =  69,
		F =  70,
		G =  71,
		H =  72,
		I =  73,
		J =  74,
		K =  75,
		L =  76,
		M =  77,
		N =  78,
		O =  79,
		P =  80,
		Q =  81,
		R =  82,
		S =  83,
		T =  84,
		U =  85,
		V =  86,
		W =  87,
		X =  88,
		Y =  89,
		Z =  90,
		UNDERSCORE = 95,
		a =  97,
		b =  98,
		c =  99,
		d = 100,
		e = 101,
		f = 102,
		g = 103,
		h = 104,
		i = 105,
		j = 106,
		k = 107,
		l = 108,
		m = 109,
		n = 110,
		o = 111,
		p = 112,
		q = 113,
		r = 114,
		s = 115,
		t = 116,
		u = 117,
		v = 118,
		w = 119,
		x = 120,
		y = 121,
		z = 122,
		LEFT_CURLY_BRACE = 123,
		RIGHT_CURLY_BRACE = 125,
	}
	
	const enum SongTagCode {
		beatCount = CharCode.a,           // added in song url version 2
		bars = CharCode.b,                // added in 2
		vibrato = CharCode.c,             // added in 2
		transition = CharCode.d,          // added in 3
		loopEnd = CharCode.e,             // added in 2
		filter = CharCode.f,              // added in 3
		barCount = CharCode.g,            // added in 3
		interval = CharCode.h,            // added in 2
		instrumentCount = CharCode.i,     // added in 3
		patternCount = CharCode.j,        // added in 3
		key = CharCode.k,                 // added in 2
		loopStart = CharCode.l,           // added in 2
		reverb = CharCode.m,              // added in 6
		channelCount = CharCode.n,        // added in 6
		channelOctave = CharCode.o,       // added in 3
		patterns = CharCode.p,            // added in 2
		effects = CharCode.q,             // added in 7
		rhythm = CharCode.r,              // added in 2
		scale = CharCode.s,               // added in 2
		tempo = CharCode.t,               // added in 2
		preset = CharCode.u,              // added in 7
		volume = CharCode.v,              // added in 2
		wave = CharCode.w,                // added in 2
		
		filterResonance = CharCode.y,     // added in 7, DEPRECATED
		filterEnvelope = CharCode.z,      // added in 7, DEPRECATED (or replace with general envelope?)
		algorithm = CharCode.A,           // added in 6
		feedbackAmplitude = CharCode.B,   // added in 6
		chord = CharCode.C,               // added in 7
		distortion = CharCode.D,          // added in 9
		operatorEnvelopes = CharCode.E,   // added in 6, DEPRECATED
		feedbackType = CharCode.F,        // added in 6
		distortionFilter = CharCode.G,    // added in 9
		harmonics = CharCode.H,           // added in 7
		
		pan = CharCode.L,                 // added between 8 and 9
		
		operatorAmplitudes = CharCode.P,  // added in 6
		operatorFrequencies = CharCode.Q, // added in 6
		bitcrusher = CharCode.R,          // added in 9
		spectrum = CharCode.S,            // added in 7
		startInstrument = CharCode.T,     // added in 6
		sustain = CharCode.U,             // added in 9
		feedbackEnvelope = CharCode.V,    // added in 6, DEPRECATED
		pulseWidth = CharCode.W,          // added in 7
	}
	
	const base64IntToCharCode: ReadonlyArray<number> = [48,49,50,51,52,53,54,55,56,57,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,45,95];
	const base64CharCodeToInt: ReadonlyArray<number> = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,62,62,0,0,1,2,3,4,5,6,7,8,9,0,0,0,0,0,0,0,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,0,0,0,0,63,0,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,0,0,0,0,0]; // 62 could be represented by either "-" or "." for historical reasons. New songs should use "-".
	
	class BitFieldReader {
		private _bits: number[] = [];
		private _readIndex: number = 0;
		
		constructor(source: string, startIndex: number, stopIndex: number) {
			for (let i: number = startIndex; i < stopIndex; i++) {
				const value: number = base64CharCodeToInt[source.charCodeAt(i)];
				this._bits.push((value >> 5) & 0x1);
				this._bits.push((value >> 4) & 0x1);
				this._bits.push((value >> 3) & 0x1);
				this._bits.push((value >> 2) & 0x1);
				this._bits.push((value >> 1) & 0x1);
				this._bits.push( value       & 0x1);
			}
		}
		
		public read(bitCount: number): number {
			let result: number = 0;
			while (bitCount > 0) {
				result = result << 1;
				result += this._bits[this._readIndex++];
				bitCount--;
			}
			return result;
		}
		
		public readLongTail(minValue: number, minBits: number): number {
			let result: number = minValue;
			let numBits: number = minBits;
			while (this._bits[this._readIndex++]) {
				result += 1 << numBits;
				numBits++;
			}
			while (numBits > 0) {
				numBits--;
				if (this._bits[this._readIndex++]) {
					result += 1 << numBits;
				}
			}
			return result;
		}
		
		public readPartDuration(): number {
			return this.readLongTail(1, 3);
		}
		
		public readLegacyPartDuration(): number {
			return this.readLongTail(1, 2);
		}
		
		public readPinCount(): number {
			return this.readLongTail(1, 0);
		}
		
		public readPitchInterval(): number {
			if (this.read(1)) {
				return -this.readLongTail(1, 3);
			} else {
				return this.readLongTail(1, 3);
			}
		}
	}
	
	class BitFieldWriter {
		private _index: number = 0;
		private _bits: number[] = [];
		
		public clear() {
			this._index = 0;
		}
		
		public write(bitCount: number, value: number): void {
			bitCount--;
			while (bitCount >= 0) {
				this._bits[this._index++] = (value >>> bitCount) & 1;
				bitCount--;
			}
		}
		
		public writeLongTail(minValue: number, minBits: number, value: number): void {
			if (value < minValue) throw new Error("value out of bounds");
			value -= minValue;
			let numBits: number = minBits;
			while (value >= (1 << numBits)) {
				this._bits[this._index++] = 1;
				value -= 1 << numBits;
				numBits++;
			}
			this._bits[this._index++] = 0;
			while (numBits > 0) {
				numBits--;
				this._bits[this._index++] = (value >>> numBits) & 1;
			}
		}
		
		public writePartDuration(value: number): void {
			this.writeLongTail(1, 3, value);
		}
		
		public writePinCount(value: number): void {
			this.writeLongTail(1, 0, value);
		}
		
		public writePitchInterval(value: number): void {
			if (value < 0) {
				this.write(1, 1); // sign
				this.writeLongTail(1, 3, -value);
			} else {
				this.write(1, 0); // sign
				this.writeLongTail(1, 3, value);
			}
		}
		
		public concat(other: BitFieldWriter): void {
			for (let i: number = 0; i < other._index; i++) {
				this._bits[this._index++] = other._bits[i];
			}
		}
		
		public encodeBase64(buffer: number[]): number[] {
			for (let i: number = 0; i < this._index; i += 6) {
				const value: number = (this._bits[i] << 5) | (this._bits[i+1] << 4) | (this._bits[i+2] << 3) | (this._bits[i+3] << 2) | (this._bits[i+4] << 1) | this._bits[i+5];
				buffer.push(base64IntToCharCode[value]);
			}
			return buffer;
		}
		
		public lengthBase64(): number {
			return Math.ceil(this._index / 6);
		}
	}
	
	export interface NotePin {
		interval: number;
		time: number;
		expression: number;
	}
	
	export function makeNotePin(interval: number, time: number, expression: number): NotePin {
		return {interval: interval, time: time, expression: expression};
	}
	
	function clamp(min: number, max: number, val: number): number {
		max = max - 1;
		if (val <= max) {
			if (val >= min) return val;
			else return min;
		} else {
			return max;
		}
	}
	
	function validateRange(min: number, max: number, val: number): number {
		if (min <= val && val <= max) return val;
		throw new Error(`Value ${val} not in range [${min}, ${max}]`);
	}
	
	export class Note {
		public pitches: number[];
		public pins: NotePin[];
		public start: number;
		public end: number;
		
		public constructor(pitch: number, start: number, end: number, expression: number, fadeout: boolean = false) {
			this.pitches = [pitch];
			this.pins = [makeNotePin(0, 0, expression), makeNotePin(0, end - start, fadeout ? 0 : expression)];
			this.start = start;
			this.end = end;
		}
		
		public pickMainInterval(): number {
			let longestFlatIntervalDuration: number = 0;
			let mainInterval: number = 0;
			for (let pinIndex: number = 1; pinIndex < this.pins.length; pinIndex++) {
				const pinA: NotePin = this.pins[pinIndex - 1];
				const pinB: NotePin = this.pins[pinIndex];
				if (pinA.interval == pinB.interval) {
					const duration: number = pinB.time - pinA.time;
					if (longestFlatIntervalDuration < duration) {
						longestFlatIntervalDuration = duration;
						mainInterval = pinA.interval;
					}
				}
			}
			if (longestFlatIntervalDuration == 0) {
				let loudestExpression: number = 0;
				for (let pinIndex: number = 0; pinIndex < this.pins.length; pinIndex++) {
					const pin: NotePin = this.pins[pinIndex];
					if (loudestExpression < pin.expression) {
						loudestExpression = pin.expression;
						mainInterval = pin.interval;
					}
				}
			}
			return mainInterval;
		}
		
		public clone(): Note {
			const newNote: Note = new Note(-1, this.start, this.end, 3);
			newNote.pitches = this.pitches.concat();
			newNote.pins = [];
			for (const pin of this.pins) {
				newNote.pins.push(makeNotePin(pin.interval, pin.time, pin.expression));
			}
			return newNote;
		}
	}
	
	export class Pattern {
		public notes: Note[] = [];
		public instrument: number = 0;
		
		public cloneNotes(): Note[] {
			const result: Note[] = [];
			for (const note of this.notes) {
				result.push(note.clone());
			}
			return result;
		}
		
		public reset(): void {
			this.notes.length = 0;
			this.instrument = 0;
		}
	}
	
	export class Operator {
		public frequency: number = 0;
		public amplitude: number = 0;
		public envelope: number = 0;
		
		constructor(index: number) {
			this.reset(index);
		}
		
		public reset(index: number): void {
			this.frequency = 0;
			this.amplitude = (index <= 1) ? Config.operatorAmplitudeMax : 0;
			this.envelope = (index == 0) ? 0 : 1;
		}
	}
	
	export class SpectrumWave {
		public spectrum: number[] = [];
		private _wave: Float32Array | null = null;
		private _waveIsReady: boolean = false;
		
		constructor(isNoiseChannel: boolean) {
			this.reset(isNoiseChannel);
		}
		
		public reset(isNoiseChannel: boolean): void {
			for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
				if (isNoiseChannel) {
					this.spectrum[i] = Math.round(Config.spectrumMax * (1 / Math.sqrt(1 + i / 3)));
				} else {
					const isHarmonic: boolean = i==0 || i==7 || i==11 || i==14 || i==16 || i==18 || i==21 || i==23 || i>=25;
					this.spectrum[i] = isHarmonic ? Math.max(0, Math.round(Config.spectrumMax * (1 - i / 30))) : 0;
				}
			}
			this._waveIsReady = false;
		}
		
		public markCustomWaveDirty(): void {
			this._waveIsReady = false;
		}
		
		public getCustomWave(lowestOctave: number): Float32Array {
			if (this._waveIsReady) return this._wave!;
			
			const waveLength: number = Config.spectrumNoiseLength;
			if (this._wave == null || this._wave.length != waveLength + 1) {
				this._wave = new Float32Array(waveLength + 1);
			}
			const wave: Float32Array = this._wave;
			
			for (let i: number = 0; i < waveLength; i++) {
				wave[i] = 0;
			}
			
			const highestOctave: number = 14;
			const falloffRatio: number = 0.25;
			// Nudge the 2/7 and 4/7 control points so that they form harmonic intervals.
			const pitchTweak: number[] = [0, 1/7, Math.log2(5/4), 3/7, Math.log2(3/2), 5/7, 6/7];
			function controlPointToOctave(point: number): number {
				return lowestOctave + Math.floor(point / Config.spectrumControlPointsPerOctave) + pitchTweak[(point + Config.spectrumControlPointsPerOctave) % Config.spectrumControlPointsPerOctave];
			}
			
			let combinedAmplitude: number = 1;
			for (let i: number = 0; i < Config.spectrumControlPoints + 1; i++) {
				const value1: number = (i <= 0) ? 0 : this.spectrum[i - 1];
				const value2: number = (i >= Config.spectrumControlPoints) ? this.spectrum[Config.spectrumControlPoints - 1] : this.spectrum[i];
				const octave1: number = controlPointToOctave(i - 1);
				let octave2: number = controlPointToOctave(i);
				if (i >= Config.spectrumControlPoints) octave2 = highestOctave + (octave2 - highestOctave) * falloffRatio;
				if (value1 == 0 && value2 == 0) continue;
				
				combinedAmplitude += 0.02 * drawNoiseSpectrum(wave, waveLength, octave1, octave2, value1 / Config.spectrumMax, value2 / Config.spectrumMax, -0.5);
			}
			if (this.spectrum[Config.spectrumControlPoints - 1] > 0) {
				combinedAmplitude += 0.02 * drawNoiseSpectrum(wave, waveLength, highestOctave + (controlPointToOctave(Config.spectrumControlPoints) - highestOctave) * falloffRatio, highestOctave, this.spectrum[Config.spectrumControlPoints - 1] / Config.spectrumMax, 0, -0.5);
			}
			
			inverseRealFourierTransform(wave, waveLength);
			scaleElementsByFactor(wave, 5.0 / (Math.sqrt(waveLength) * Math.pow(combinedAmplitude, 0.75)));
			
			// Duplicate the first sample at the end for easier wrap-around interpolation.
			wave[waveLength] = wave[0];
			
			this._waveIsReady = true;
			return wave;
		}
	}
	
	export class HarmonicsWave {
		public harmonics: number[] = [];
		private _wave: Float32Array | null = null;
		private _waveIsReady: boolean = false;
		
		constructor() {
			this.reset();
		}
		
		public reset(): void {
			for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
				this.harmonics[i] = 0;
			}
			this.harmonics[0] = Config.harmonicsMax;
			this.harmonics[3] = Config.harmonicsMax;
			this.harmonics[6] = Config.harmonicsMax;
			this._waveIsReady = false;
		}
		
		public markCustomWaveDirty(): void {
			this._waveIsReady = false;
		}
		
		public getCustomWave(): Float32Array {
			if (this._waveIsReady) return this._wave!;
			
			const waveLength: number = Config.harmonicsWavelength;
			const retroWave: Float32Array = getDrumWave(0, null, null);
			
			if (this._wave == null || this._wave.length != waveLength + 1) {
				this._wave = new Float32Array(waveLength + 1);
			}
			const wave: Float32Array = this._wave;
			
			for (let i: number = 0; i < waveLength; i++) {
				wave[i] = 0;
			}
			
			const overallSlope: number = -0.25;
			let combinedControlPointAmplitude: number = 1;
			
			for (let harmonicIndex: number = 0; harmonicIndex < Config.harmonicsRendered; harmonicIndex++) {
				const harmonicFreq: number = harmonicIndex + 1;
				let controlValue: number = harmonicIndex < Config.harmonicsControlPoints ? this.harmonics[harmonicIndex] : this.harmonics[Config.harmonicsControlPoints - 1];
				if (harmonicIndex >= Config.harmonicsControlPoints) {
					controlValue *= 1 - (harmonicIndex - Config.harmonicsControlPoints) / (Config.harmonicsRendered - Config.harmonicsControlPoints);
				}
				const normalizedValue: number = controlValue / Config.harmonicsMax;
				let amplitude: number = Math.pow(2, controlValue - Config.harmonicsMax + 1) * Math.sqrt(normalizedValue);
				if (harmonicIndex < Config.harmonicsControlPoints) {
					combinedControlPointAmplitude += amplitude;
				}
				amplitude *= Math.pow(harmonicFreq, overallSlope);
				
				// Multiply all the sine wave amplitudes by 1 or -1 based on the LFSR
				// retro wave (effectively random) to avoid egregiously tall spikes.
				amplitude *= retroWave[harmonicIndex + 589];
				
				wave[waveLength - harmonicFreq] = amplitude;
			}
			
			inverseRealFourierTransform(wave, waveLength);
			
			// Limit the maximum wave amplitude.
			const mult: number = 1 / Math.pow(combinedControlPointAmplitude, 0.7);
			for (let i: number = 0; i < wave.length; i++) wave[i] *= mult;
			
			performIntegral(wave);
			
			// The first sample should be zero, and we'll duplicate it at the end for easier interpolation.
			wave[waveLength] = wave[0];
			
			this._waveIsReady = true;
			return wave;
		}
	}
	
	export class GuitarImpulseWave {
		private static _wave: Float32Array | null = null;
		
		private constructor () { throw new Error(); } // Don't instantiate.
		
		public static getWave(): Float32Array {
			if (GuitarImpulseWave._wave != null) return GuitarImpulseWave._wave;
			
			const waveLength: number = Config.harmonicsWavelength;
			GuitarImpulseWave._wave = new Float32Array(waveLength + 1);
			const wave: Float32Array = GuitarImpulseWave._wave;
			const retroWave: Float32Array = getDrumWave(0, null, null);
			
			for (let harmonicFreq: number = 1; harmonicFreq < (waveLength >> 1); harmonicFreq++) {
				let amplitude: number = 0.5 / harmonicFreq; // The symmetric inverse FFT doubles amplitudes, compensating for that here.
				
				// Multiply all the sine wave amplitudes by 1 or -1 based on the LFSR
				// retro wave (effectively random) to avoid egregiously tall spikes.
				amplitude *= retroWave[harmonicFreq + 588];
				
				/*
				const radians: number = 0.61803398875 * harmonicFreq * harmonicFreq * Math.PI * 2.0;
				wave[harmonicFreq] = Math.sin(radians) * amplitude;
				wave[waveLength - harmonicFreq] = Math.cos(radians) * amplitude;
				*/
				wave[waveLength - harmonicFreq] = amplitude;
			}
			
			inverseRealFourierTransform(wave, waveLength);
			performIntegral(wave);
			// The first sample should be zero, and we'll duplicate it at the end for easier interpolation.
			wave[waveLength] = wave[0];
			return wave;
		}
	}
	
	export class FilterControlPoint {
		public freq: number = 0;
		public gain: number = Config.filterGainCenter;
		public type: FilterType = FilterType.peak;
		
		public set(freqSetting: number, gainSetting: number): void {
			this.freq = freqSetting;
			this.gain = gainSetting;
		}
		
		public getHz(): number {
			return FilterControlPoint.getHzFromSettingValue(this.freq);
		}
		
		public static getHzFromSettingValue(value: number): number {
			return Config.filterFreqMaxHz * Math.pow(2.0, (value - (Config.filterFreqRange - 1)) * Config.filterFreqStep);
		}
		public static getSettingValueFromHz(hz: number): number {
			return Math.log2(hz / Config.filterFreqMaxHz) / Config.filterFreqStep + (Config.filterFreqRange - 1);
		}
		public static getRoundedSettingValueFromHz(hz: number): number {
			return Math.max(0, Math.min(Config.filterFreqRange - 1, Math.round(FilterControlPoint.getSettingValueFromHz(hz))));
		}
		
		public getLinearGain(gainRangeMult: number = 1.0): number {
			return Math.pow(2.0, (this.gain - Config.filterGainCenter) * Config.filterGainStep * gainRangeMult);
		}
		public static getRoundedSettingValueFromLinearGain(linearGain: number): number {
			return Math.max(0, Math.min(Config.filterGainRange - 1, Math.round(Math.log2(linearGain) / Config.filterGainStep + Config.filterGainCenter)));
		}
		
		public toCoefficients(filter: FilterCoefficients, sampleRate: number, freqMult: number = 1.0, gainMult: number = 1.0, gainRangeMult: number = 1.0): void {
			const cornerRadiansPerSample: number = 2.0 * Math.PI * Math.max(Config.filterFreqMinHz, Math.min(Config.filterFreqMaxHz, freqMult * this.getHz())) / sampleRate;
			const linearGain: number = gainMult * this.getLinearGain(gainRangeMult);
			switch (this.type) {
				case FilterType.lowPass:
					filter.lowPass2ndOrderButterworth(cornerRadiansPerSample, linearGain);
					break;
				case FilterType.highPass:
					filter.highPass2ndOrderButterworth(cornerRadiansPerSample, linearGain);
					break;
				case FilterType.peak:
					filter.peak2ndOrder(cornerRadiansPerSample, linearGain, 1.0);
					break;
				default:
					throw new Error();
			}
		}
		
		public getVolumeCompensationMult(): number {
			const octave: number = (this.freq - (Config.filterFreqRange - 1)) * Config.filterFreqStep;
			const gainPow: number = (this.gain - Config.filterGainCenter) * Config.filterGainStep;
			switch (this.type) {
				case FilterType.lowPass:
					const freqRelativeTo8khz: number = Math.pow(2.0, octave) * Config.filterFreqMaxHz / 8000.0;
					// Reverse the frequency warping from importing legacy simplified filters to imitate how the legacy filter cutoff setting affected volume.
					const warpedFreq: number = (Math.sqrt(1.0 + 4.0 * freqRelativeTo8khz) - 1.0) / 2.0;
					const warpedOctave: number = Math.log2(warpedFreq);
					return Math.pow(0.5, 0.2 * Math.max(0.0, gainPow + 1.0) + Math.min(0.0, Math.max(-3.0, 0.595 * warpedOctave + 0.35 * Math.min(0.0, gainPow + 1.0))));
				case FilterType.highPass:
					return Math.pow(0.5, 0.125 * Math.max(0.0, gainPow + 1.0) + Math.min(0.0, 0.3 * (-octave - Math.log2(Config.filterFreqMaxHz / 125.0)) + 0.2 * Math.min(0.0, gainPow + 1.0)));
				case FilterType.peak:
					const distanceFromCenter: number = octave + Math.log2(Config.filterFreqMaxHz / 2000.0);
					const freqLoudness: number = Math.pow(1.0 / (1.0 + Math.pow(distanceFromCenter / 3.0, 2.0)), 2.0);
					return Math.pow(0.5, 0.125 * Math.max(0.0, gainPow) + 0.1 * freqLoudness * Math.min(0.0, gainPow));
				default:
					throw new Error();
			}
		}
	}
	
	export class FilterSettings {
		public readonly controlPoints: FilterControlPoint[] = [];
		public controlPointCount: number = 0;
		
		constructor() {
			this.reset();
		}
		
		reset(): void {
			this.controlPointCount = 0;
		}
		
		addPoint(type: FilterType, freqSetting: number, gainSetting: number): void {
			let controlPoint: FilterControlPoint;
			if (this.controlPoints.length <= this.controlPointCount) {
				controlPoint = new FilterControlPoint();
				this.controlPoints[this.controlPointCount] = controlPoint;
			} else {
				controlPoint = this.controlPoints[this.controlPointCount];
			}
			this.controlPointCount++;
			controlPoint.type = type;
			controlPoint.set(freqSetting, gainSetting);
		}
		
		public toJsonObject(): Object {
			const filterArray: any[] = [];
			for (let i: number = 0; i < this.controlPointCount; i++) {
				const point: FilterControlPoint = this.controlPoints[i];
				filterArray.push({
					"type": Config.filterTypeNames[point.type],
					"cutoffHz": Math.round(point.getHz() * 100) / 100,
					"linearGain": Math.round(point.getLinearGain() * 10000) / 10000,
				});
			}
			return filterArray;
		}
		
		public fromJsonObject(filterObject: any): void {
			this.controlPoints.length = 0;
			if (filterObject) {
				for (const pointObject of filterObject) {
					const point: FilterControlPoint = new FilterControlPoint();
					point.type = Config.filterTypeNames.indexOf(pointObject["type"]);
					if (point.type == -1) point.type = FilterType.peak;
					if (pointObject["cutoffHz"]) {
						point.freq = FilterControlPoint.getRoundedSettingValueFromHz(pointObject["cutoffHz"]);
					} else {
						point.freq = 0;
					}
					if (pointObject["linearGain"]) {
						point.gain = FilterControlPoint.getRoundedSettingValueFromLinearGain(pointObject["linearGain"]);
					} else {
						point.gain = Config.filterGainCenter;
					}
					this.controlPoints.push(point);
				}
			}
			this.controlPointCount = this.controlPoints.length;
		}
		
		public convertLegacySettings(legacyCutoffSetting: number | undefined, legacyResonanceSetting: number | undefined, legacyEnv: Envelope, instrumentType: InstrumentType): void {
			this.reset();
			
			// legacy defaults:
			if (legacyCutoffSetting == undefined) legacyCutoffSetting = (instrumentType == InstrumentType.chip) ? 6 : 10;
			if (legacyResonanceSetting == undefined) legacyResonanceSetting = 0;
			
			const legacyFilterCutoffMaxHz: number = 8000; // This was carefully calculated to correspond to no change in response when filtering at 48000 samples per second... when using the legacy simplified low-pass filter.
			const legacyFilterMax: number = 0.95;
			const legacyFilterMaxRadians: number = Math.asin(legacyFilterMax / 2.0) * 2.0;
			const legacyFilterMaxResonance: number = 0.95;
			const legacyFilterCutoffRange: number = 11;
			const legacyFilterResonanceRange: number = 8;
			
			const resonant: boolean = (legacyResonanceSetting > 1);
			const firstOrder: boolean = (legacyResonanceSetting == 0);
			const cutoffAtMax: boolean = (legacyCutoffSetting == legacyFilterCutoffRange - 1);
			const envDecays: boolean = (legacyEnv.type == EnvelopeType.flare || legacyEnv.type == EnvelopeType.twang || legacyEnv.type == EnvelopeType.decay || legacyEnv.type == EnvelopeType.custom);
			
			const standardSampleRate: number = 48000;
			const legacyHz: number = legacyFilterCutoffMaxHz * Math.pow(2.0, (legacyCutoffSetting - (legacyFilterCutoffRange - 1)) * 0.5);
			const legacyRadians: number = Math.min(legacyFilterMaxRadians, 2 * Math.PI * legacyHz / standardSampleRate);
			
			if (!envDecays && !resonant && cutoffAtMax) {
				// The response is flat and there's no envelopes, so don't even bother adding any control points.
			} else if (firstOrder) {
				// In general, a 1st order lowpass can be approximated by a 2nd order lowpass
				// with a cutoff ~4 octaves higher (*16) and a gain of 1/16.
				// However, BeepBox's original lowpass filters behaved oddly as they
				// approach the nyquist frequency, so I've devised this curved conversion
				// to guess at a perceptually appropriate new cutoff frequency and gain.
				const extraOctaves: number = 3.5;
				const targetRadians: number = legacyRadians * Math.pow(2.0, extraOctaves);
				const curvedRadians: number = targetRadians / (1.0 + targetRadians / (Math.PI * 0.8));
				const curvedHz: number = standardSampleRate * curvedRadians / (2.0 * Math.PI)
				const freqSetting: number = FilterControlPoint.getRoundedSettingValueFromHz(curvedHz);
				const finalHz: number = FilterControlPoint.getHzFromSettingValue(freqSetting);
				const finalRadians: number = 2.0 * Math.PI * finalHz / standardSampleRate;
				
				const legacyFilter: FilterCoefficients = new FilterCoefficients();
				legacyFilter.lowPass1stOrderSimplified(legacyRadians);
				const response: FrequencyResponse = new FrequencyResponse();
				response.analyze(legacyFilter, finalRadians);
				const legacyFilterGainAtNewRadians: number = response.magnitude();
				
				let logGain: number = Math.log2(legacyFilterGainAtNewRadians);
				// Bias slightly toward 2^(-extraOctaves):
				logGain = -extraOctaves + (logGain + extraOctaves) * 0.82;
				// Decaying envelopes move the cutoff frequency back into an area where the best approximation of the first order slope requires a lower gain setting.
				if (envDecays) logGain = Math.min(logGain, -2.0);
				const convertedGain: number = Math.pow(2.0, logGain);
				const gainSetting: number = FilterControlPoint.getRoundedSettingValueFromLinearGain(convertedGain);
				
				this.addPoint(FilterType.lowPass, freqSetting, gainSetting);
			} else {
				const intendedGain: number = 0.5 / (1.0 - legacyFilterMaxResonance * Math.sqrt(Math.max(0.0, legacyResonanceSetting - 1.0) / (legacyFilterResonanceRange - 2.0)));
				const invertedGain: number = 0.5 / intendedGain;
				const maxRadians: number = 2.0 * Math.PI * legacyFilterCutoffMaxHz / standardSampleRate;
				const freqRatio: number = legacyRadians / maxRadians;
				const targetRadians: number = legacyRadians * (freqRatio * Math.pow(invertedGain, 0.9) + 1.0);
				const curvedRadians: number = legacyRadians + (targetRadians - legacyRadians) * invertedGain;
				let curvedHz: number;
				if (envDecays) {
					curvedHz = standardSampleRate * Math.min(curvedRadians, legacyRadians * Math.pow(2, 0.25)) / (2.0 * Math.PI)
				} else {
					curvedHz = standardSampleRate * curvedRadians / (2.0 * Math.PI)
				}
				const freqSetting: number = FilterControlPoint.getRoundedSettingValueFromHz(curvedHz);
				
				let legacyFilterGain: number;
				if (envDecays) {
					legacyFilterGain = intendedGain;
				} else {
					const legacyFilter: FilterCoefficients = new FilterCoefficients();
					legacyFilter.lowPass2ndOrderSimplified(legacyRadians, intendedGain);
					const response: FrequencyResponse = new FrequencyResponse();
					response.analyze(legacyFilter, curvedRadians);
					legacyFilterGain = response.magnitude();
				}
				if (!resonant) legacyFilterGain = Math.min(legacyFilterGain, Math.sqrt(0.5));
				const gainSetting: number = FilterControlPoint.getRoundedSettingValueFromLinearGain(legacyFilterGain);
				
				this.addPoint(FilterType.lowPass, freqSetting, gainSetting);
			}
		}
	}
	
	export class Instrument {
		public type: InstrumentType = InstrumentType.chip;
		public preset: number = 0;
		public chipWave: number = 2;
		public chipNoise: number = 1;
		public filter: FilterSettings = new FilterSettings();
		public distortionFilter: FilterSettings = new FilterSettings();
		public filterEnvelope: number = 1;
		public transition: number = 1;
		public vibrato: number = 0;
		public interval: number = 0;
		public effects: number = 0;
		public chord: number = 1;
		public volume: number = 0;
		public pan: number = Config.panCenter;
		public pulseWidth: number = Config.pulseWidthRange - 1;
		public pulseEnvelope: number = 1;
		public sustain: number = 6;
		public distortion: number = 0;
		public bitcrusherFreq: number = 0;
		public bitcrusherQuantization: number = 0;
		public reverb: number = 0;
		public algorithm: number = 0;
		public feedbackType: number = 0;
		public feedbackAmplitude: number = 0;
		public feedbackEnvelope: number = 1;
		public readonly operators: Operator[] = [];
		public readonly spectrumWave: SpectrumWave;
		public readonly harmonicsWave: HarmonicsWave = new HarmonicsWave();
		public readonly drumsetEnvelopes: number[] = [];
		public readonly drumsetSpectrumWaves: SpectrumWave[] = [];
		
		constructor(isNoiseChannel: boolean) {
			this.spectrumWave = new SpectrumWave(isNoiseChannel);
			for (let i: number = 0; i < Config.operatorCount; i++) {
				this.operators[i] = new Operator(i);
			}
			for (let i: number = 0; i < Config.drumCount; i++) {
				this.drumsetEnvelopes[i] = Config.envelopes.dictionary["twang 2"].index;
				this.drumsetSpectrumWaves[i] = new SpectrumWave(true);
			}
		}
		
		public setTypeAndReset(type: InstrumentType, isNoiseChannel: boolean): void {
			this.type = type;
			this.preset = type;
			this.volume = 0;
			this.reverb = 2;
			this.distortionFilter.reset();
			this.distortion = Math.floor((Config.distortionRange - 1) * 0.75);
			this.bitcrusherFreq = Math.floor((Config.bitcrusherFreqRange - 1) * 0.5)
			this.bitcrusherQuantization = Math.floor((Config.bitcrusherQuantizationRange - 1) * 0.5);
			this.pan = Config.panCenter;
			this.filter.reset();
			this.vibrato = 0;
			this.interval = 0;
			this.transition = Config.transitions.dictionary["hard"].index;
			this.filterEnvelope = Config.envelopes.dictionary["steady"].index;
			switch (type) {
				case InstrumentType.chip:
					this.chipWave = 2;
					this.effects = 1;
					this.chord = 2;
					break;
				case InstrumentType.fm:
					this.effects = 1;
					this.chord = 3;
					this.algorithm = 0;
					this.feedbackType = 0;
					this.feedbackAmplitude = 0;
					this.feedbackEnvelope = Config.envelopes.dictionary["steady"].index;
					for (let i: number = 0; i < this.operators.length; i++) {
						this.operators[i].reset(i);
					}
					break;
				case InstrumentType.noise:
					this.chipNoise = 1;
					this.effects = 0;
					this.chord = 2;
					break;
				case InstrumentType.spectrum:
					this.effects = 1;
					this.chord = 0;
					this.spectrumWave.reset(isNoiseChannel);
					break;
				case InstrumentType.drumset:
					this.effects = 0;
					for (let i: number = 0; i < Config.drumCount; i++) {
						this.drumsetEnvelopes[i] = Config.envelopes.dictionary["twang 2"].index;
						this.drumsetSpectrumWaves[i].reset(isNoiseChannel);
					}
					break;
				case InstrumentType.harmonics:
					this.effects = 1;
					this.chord = 0;
					this.harmonicsWave.reset();
					break;
				case InstrumentType.pwm:
					this.effects = 1;
					this.chord = 2;
					this.pulseWidth = Config.pulseWidthRange - 1;
					this.pulseEnvelope = Config.envelopes.dictionary["twang 2"].index;
					break;
				case InstrumentType.guitar:
					this.effects = 1;
					this.chord = 3;
					this.pulseWidth = Config.pulseWidthRange - 3;
					this.sustain = 6;
					break;
				default:
					throw new Error("Unrecognized instrument type: " + type);
			}
		}
		
		public toJsonObject(): Object {
			const instrumentObject: any = {
				"type": Config.instrumentTypeNames[this.type],
				"volume": (5 - this.volume) * 20,
				"filter": this.filter.toJsonObject(),
			};
			
			if (this.preset != this.type) {
				instrumentObject["preset"] = this.preset;
			}
			
			const effects: string[] = [];
			for (const effect of Config.effectOrder) {
				if (this.effects & (1 << effect)) {
					effects.push(Config.effectsNames[effect]);
				}
			}
			instrumentObject["effects"] = effects;
			
			if (effectsIncludeDistortion(this.effects)) {
				instrumentObject["distortionFilter"] = this.distortionFilter.toJsonObject();
				instrumentObject["distortion"] = Math.round(100 * this.distortion / (Config.distortionRange - 1));
			}
			if (effectsIncludeBitcrusher(this.effects)) {
				instrumentObject["bitcrusherOctave"] = (Config.bitcrusherFreqRange - 1 - this.bitcrusherFreq) * Config.bitcrusherOctaveStep;
				instrumentObject["bitcrusherQuantization"] = Math.round(100 * this.bitcrusherQuantization / (Config.bitcrusherQuantizationRange - 1));
			}
			if (effectsIncludePanning(this.effects)) {
				instrumentObject["pan"] = Math.round(100 * (this.pan - Config.panCenter) / Config.panCenter);
			}
			if (effectsIncludeReverb(this.effects)) {
				instrumentObject["reverb"] = Math.round(100 * this.reverb / (Config.reverbRange - 1));
			}
			
			if (this.type != InstrumentType.drumset) {
				instrumentObject["transition"] = Config.transitions[this.transition].name;
				instrumentObject["chord"] = this.getChord().name;
				instrumentObject["filterEnvelope"] = this.getFilterEnvelope().name; // DEPRECATED
			}
			
			if (this.type == InstrumentType.noise) {
				instrumentObject["wave"] = Config.chipNoises[this.chipNoise].name;
			} else if (this.type == InstrumentType.spectrum) {
				instrumentObject["spectrum"] = [];
				for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
					instrumentObject["spectrum"][i] = Math.round(100 * this.spectrumWave.spectrum[i] / Config.spectrumMax);
				}
			} else if (this.type == InstrumentType.drumset) {
				instrumentObject["drums"] = [];
				for (let j: number = 0; j < Config.drumCount; j++) {
					const spectrum: number[] = [];
					for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
						spectrum[i] = Math.round(100 * this.drumsetSpectrumWaves[j].spectrum[i] / Config.spectrumMax);
					}
					instrumentObject["drums"][j] = {
						"filterEnvelope": this.getDrumsetEnvelope(j).name,
						"spectrum": spectrum,
					};
				}
			} else if (this.type == InstrumentType.chip) {
				instrumentObject["wave"] = Config.chipWaves[this.chipWave].name;
				instrumentObject["interval"] = Config.intervals[this.interval].name;
				instrumentObject["vibrato"] = Config.vibratos[this.vibrato].name;
			} else if (this.type == InstrumentType.pwm) {
				instrumentObject["pulseWidth"] = Math.round(getPulseWidthRatio(this.pulseWidth) * 100 * 100000) / 100000;
				instrumentObject["pulseEnvelope"] = Config.envelopes[this.pulseEnvelope].name;
				instrumentObject["vibrato"] = Config.vibratos[this.vibrato].name;
			} else if (this.type == InstrumentType.guitar) {
				instrumentObject["pulseWidth"] = Math.round(getPulseWidthRatio(this.pulseWidth) * 100 * 100000) / 100000;
				instrumentObject["sustain"] = Math.round(100 * this.sustain / (Config.sustainRange - 1));
				instrumentObject["vibrato"] = Config.vibratos[this.vibrato].name;
			} else if (this.type == InstrumentType.harmonics) {
				instrumentObject["interval"] = Config.intervals[this.interval].name;
				instrumentObject["vibrato"] = Config.vibratos[this.vibrato].name;
				instrumentObject["harmonics"] = [];
				for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
					instrumentObject["harmonics"][i] = Math.round(100 * this.harmonicsWave.harmonics[i] / Config.harmonicsMax);
				}
			} else if (this.type == InstrumentType.fm) {
				const operatorArray: Object[] = [];
				for (const operator of this.operators) {
					operatorArray.push({
						"frequency": Config.operatorFrequencies[operator.frequency].name,
						"amplitude": operator.amplitude,
						"envelope": Config.envelopes[operator.envelope].name,
					});
				}
				instrumentObject["vibrato"] = Config.vibratos[this.vibrato].name;
				instrumentObject["algorithm"] = Config.algorithms[this.algorithm].name;
				instrumentObject["feedbackType"] = Config.feedbacks[this.feedbackType].name;
				instrumentObject["feedbackAmplitude"] = this.feedbackAmplitude;
				instrumentObject["feedbackEnvelope"] = Config.envelopes[this.feedbackEnvelope].name;
				instrumentObject["operators"] = operatorArray;
			} else {
				throw new Error("Unrecognized instrument type");
			}
			return instrumentObject;
		}
		
		public fromJsonObject(instrumentObject: any, isNoiseChannel: boolean, legacyGlobalReverb: number = 0): void {
			if (instrumentObject == undefined) instrumentObject = {};
			
			let type: InstrumentType = Config.instrumentTypeNames.indexOf(instrumentObject["type"]);
			if (type == -1) type = isNoiseChannel ? InstrumentType.noise : InstrumentType.chip;
			this.setTypeAndReset(type, isNoiseChannel);
			
			if (instrumentObject["preset"] != undefined) {
				this.preset = instrumentObject["preset"] >>> 0;
			}
			
			if (instrumentObject["volume"] != undefined) {
				this.volume = clamp(0, Config.volumeRange, Math.round(5 - (instrumentObject["volume"] | 0) / 20));
			} else {
				this.volume = 0;
			}
			
			const oldTransitionNames: Dictionary<number> = {"binary": 0, "sudden": 1, "smooth": 2};
			const transitionObject = instrumentObject["transition"] || instrumentObject["envelope"]; // the transition property used to be called envelope, so try that too.
			this.transition = oldTransitionNames[transitionObject] != undefined ? oldTransitionNames[transitionObject] : Config.transitions.findIndex(transition=>transition.name==transitionObject);
			if (this.transition == -1) this.transition = 1;
			
			this.filterEnvelope = Config.envelopes.findIndex(envelope=>envelope.name == instrumentObject["filterEnvelope"]);
			if (this.filterEnvelope == -1) this.filterEnvelope = Config.envelopes.dictionary["steady"].index;
			if (Array.isArray(instrumentObject["filter"])) {
				this.filter.fromJsonObject(instrumentObject["filter"]);
			} else {
				// Convert from legacy filter settings.
				let legacyCutoffSetting: number | undefined = undefined;
				let legacyResonanceSetting: number | undefined = undefined;
				const filterCutoffMaxHz: number = 8000;
				const filterCutoffRange: number = 11;
				const filterResonanceRange: number = 8;
				if (instrumentObject["filterCutoffHz"] != undefined) {
					legacyCutoffSetting = clamp(0, filterCutoffRange, Math.round((filterCutoffRange - 1) + 2.0 * Math.log((instrumentObject["filterCutoffHz"] | 0) / filterCutoffMaxHz) / Math.LN2));
				} else {
					legacyCutoffSetting = (this.type == InstrumentType.chip) ? 6 : 10;
				}
				if (instrumentObject["filterResonance"] != undefined) {
					legacyResonanceSetting = clamp(0, filterResonanceRange, Math.round((filterResonanceRange - 1) * (instrumentObject["filterResonance"] | 0) / 100));
				} else {
					legacyResonanceSetting = 0;
				}
				
				if (instrumentObject["filter"] != undefined) {
					const legacyToCutoff: number[] = [10, 6, 3, 0, 8, 5, 2];
					const legacyToEnvelope: string[] = ["steady", "steady", "steady", "steady", "decay 1", "decay 2", "decay 3"];
					const filterNames: string[] = ["none", "bright", "medium", "soft", "decay bright", "decay medium", "decay soft"];
					const oldFilterNames: Dictionary<number> = {"sustain sharp": 1, "sustain medium": 2, "sustain soft": 3, "decay sharp": 4};
					let legacyFilter: number = oldFilterNames[instrumentObject["filter"]] != undefined ? oldFilterNames[instrumentObject["filter"]] : filterNames.indexOf(instrumentObject["filter"]);
					if (legacyFilter == -1) legacyFilter = 0;
					legacyCutoffSetting = legacyToCutoff[legacyFilter];
					this.filterEnvelope = Config.envelopes.dictionary[legacyToEnvelope[legacyFilter]].index;
					legacyResonanceSetting = 0;
				}
				
				this.filter.convertLegacySettings(legacyCutoffSetting, legacyResonanceSetting, Config.envelopes[this.filterEnvelope], this.type);
			}
			
			if (instrumentObject["interval"] != undefined) {
				this.interval = Config.intervals.findIndex(interval=>interval.name==instrumentObject["interval"]);
				if (this.interval == -1) this.interval = 0;
			} else if (instrumentObject["chorus"] != undefined) {
				const legacyChorusNames: Dictionary<number> = {"fifths": 5, "octaves": 6};
				this.interval = legacyChorusNames[instrumentObject["chorus"]] != undefined ? legacyChorusNames[instrumentObject["chorus"]] : Config.intervals.findIndex(interval=>interval.name==instrumentObject["chorus"]);
				if (this.interval == -1) this.interval = 0;
			}
			
			if (instrumentObject["vibrato"] != undefined) {
				this.vibrato = Config.vibratos.findIndex(vibrato=>vibrato.name==instrumentObject["vibrato"]);
				if (this.vibrato == -1) this.vibrato = 0;
			} else if (instrumentObject["effect"] != undefined) {
				const legacyEffectNames: ReadonlyArray<string> = ["none", "vibrato light", "vibrato delayed", "vibrato heavy"];
				this.vibrato = legacyEffectNames.indexOf(instrumentObject["effect"]);
				if (this.vibrato == -1) this.vibrato = 0;
			}
			
			if (instrumentObject["pulseWidth"] != undefined) {
				this.pulseWidth = clamp(0, Config.pulseWidthRange, Math.round(Math.log2((+instrumentObject["pulseWidth"]) / 50) / 0.5 - 1 + 8));
			} else {
				this.pulseWidth = Config.pulseWidthRange - 1;
			}
			
			if (instrumentObject["pan"] != undefined) {
				this.pan = clamp(0, Config.panMax + 1, Math.round(Config.panCenter + (instrumentObject["pan"] | 0) * Config.panCenter / 100));
			} else {
				this.pan = Config.panCenter;
			}
			
			if (Array.isArray(instrumentObject["effects"])) {
				let effects: number = 0;
				for (let i: number = 0; i < instrumentObject["effects"].length; i++) {
					effects = effects | (1 << Config.effectsNames.indexOf(instrumentObject["effects"][i]));
				}
				this.effects = (effects & ((1 << EffectType.length) - 1));
			} else {
				const legacyEffectsNames: string[] = ["none", "reverb", "chorus", "chorus & reverb"];
				this.effects = legacyEffectsNames.indexOf(instrumentObject["effects"]);
				if (this.effects == -1) this.effects = (this.type == InstrumentType.noise) ? 0 : 1;
				
				// Old songs may have a panning value without explicitly enabling it.
				if (this.pan != Config.panCenter) {
					this.effects = (this.effects | (1 << EffectType.panning));
				}
			}
			
			if (instrumentObject["distortionFilter"] != undefined) {
				this.distortionFilter.fromJsonObject(instrumentObject["distortionFilter"]);
			} else {
				this.distortionFilter.reset();
			}
			if (instrumentObject["distortion"] != undefined) {
				this.distortion = clamp(0, Config.distortionRange, Math.round((Config.distortionRange - 1) * (instrumentObject["distortion"] | 0) / 100));
			}
			
			if (instrumentObject["bitcrusherOctave"] != undefined) {
				this.bitcrusherFreq = Config.bitcrusherFreqRange - 1 - (+instrumentObject["bitcrusherOctave"]) / Config.bitcrusherOctaveStep;
			}
			if (instrumentObject["bitcrusherQuantization"] != undefined) {
				this.bitcrusherQuantization = clamp(0, Config.bitcrusherQuantizationRange, Math.round((Config.bitcrusherQuantizationRange - 1) * (instrumentObject["bitcrusherQuantization"] | 0) / 100));
			}
			
			if (instrumentObject["reverb"] != undefined) {
				this.reverb = clamp(0, Config.reverbRange, Math.round((Config.reverbRange - 1) * (instrumentObject["reverb"] | 0) / 100));
			} else {
				if (legacyGlobalReverb == 0) {
					// If the original song reverb was zero, just disable the instrument reverb effect entirely.
					this.effects = (this.effects & (~(1 << EffectType.reverb)));
				} else {
					this.reverb = legacyGlobalReverb;
				}
			}
			
			if (instrumentObject["sustain"] != undefined) {
				this.sustain = clamp(0, Config.sustainRange, Math.round((Config.sustainRange - 1) * (instrumentObject["sustain"] | 0) / 100));
			} else {
				this.sustain = 6;
			}
			
			if (this.type == InstrumentType.noise) {
				this.chipNoise = Config.chipNoises.findIndex(wave=>wave.name==instrumentObject["wave"]);
				if (this.chipNoise == -1) this.chipNoise = 1;

				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 2;

			} else if (this.type == InstrumentType.spectrum) {
				if (instrumentObject["spectrum"] != undefined) {
					for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
						this.spectrumWave.spectrum[i] = Math.max(0, Math.min(Config.spectrumMax, Math.round(Config.spectrumMax * (+instrumentObject["spectrum"][i]) / 100)));
					}
				}
				
				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 0;
				
			} else if (this.type == InstrumentType.drumset) {
				if (instrumentObject["drums"] != undefined) {
					for (let j: number = 0; j < Config.drumCount; j++) {
						const drum: any = instrumentObject["drums"][j];
						if (drum == undefined) continue;
						
						if (drum["filterEnvelope"] != undefined) {
							this.drumsetEnvelopes[j] = Config.envelopes.findIndex(envelope=>envelope.name == drum["filterEnvelope"]);
							if (this.drumsetEnvelopes[j] == -1) this.drumsetEnvelopes[j] = Config.envelopes.dictionary["twang 2"].index;
						}
						if (drum["spectrum"] != undefined) {
							for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
								this.drumsetSpectrumWaves[j].spectrum[i] = Math.max(0, Math.min(Config.spectrumMax, Math.round(Config.spectrumMax * (+drum["spectrum"][i]) / 100)));
							}
						}
					}
				}
			} else if (this.type == InstrumentType.harmonics) {
				if (instrumentObject["harmonics"] != undefined) {
					for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
						this.harmonicsWave.harmonics[i] = Math.max(0, Math.min(Config.harmonicsMax, Math.round(Config.harmonicsMax * (+instrumentObject["harmonics"][i]) / 100)));
					}
				}
				
				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 0;
			} else if (this.type == InstrumentType.pwm) {
				if (instrumentObject["pulseEnvelope"] != undefined) {
					this.pulseEnvelope = Config.envelopes.findIndex(envelope=>envelope.name == instrumentObject["pulseEnvelope"]);
					if (this.pulseEnvelope == -1) this.pulseEnvelope = Config.envelopes.dictionary["steady"].index;
				}
				
				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 0;
			} else if (this.type == InstrumentType.guitar) {
				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 3;
			} else if (this.type == InstrumentType.chip) {
				const legacyWaveNames: Dictionary<number> = {"triangle": 1, "square": 2, "pulse wide": 3, "pulse narrow": 4, "sawtooth": 5, "double saw": 6, "double pulse": 7, "spiky": 8, "plateau": 0};
				this.chipWave = legacyWaveNames[instrumentObject["wave"]] != undefined ? legacyWaveNames[instrumentObject["wave"]] : Config.chipWaves.findIndex(wave=>wave.name==instrumentObject["wave"]);
				if (this.chipWave == -1) this.chipWave = 1;
				
				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 2;

				// The original chorus setting had an option that now maps to two different settings. Override those if necessary.
				if (instrumentObject["chorus"] == "custom harmony") {
					this.interval = 2;
					this.chord = 3;
				}
			} else if (this.type == InstrumentType.fm) {
				this.chord = Config.chords.findIndex(chord=>chord.name==instrumentObject["chord"]);
				if (this.chord == -1) this.chord = 3;

				this.algorithm = Config.algorithms.findIndex(algorithm=>algorithm.name==instrumentObject["algorithm"]);
				if (this.algorithm == -1) this.algorithm = 0;
				this.feedbackType = Config.feedbacks.findIndex(feedback=>feedback.name==instrumentObject["feedbackType"]);
				if (this.feedbackType == -1) this.feedbackType = 0;
				if (instrumentObject["feedbackAmplitude"] != undefined) {
					this.feedbackAmplitude = clamp(0, Config.operatorAmplitudeMax + 1, instrumentObject["feedbackAmplitude"] | 0);
				} else {
					this.feedbackAmplitude = 0;
				}
				
				const legacyEnvelopeNames: Dictionary<number> = {"pluck 1": 6, "pluck 2": 7, "pluck 3": 8};
				this.feedbackEnvelope = legacyEnvelopeNames[instrumentObject["feedbackEnvelope"]] != undefined ? legacyEnvelopeNames[instrumentObject["feedbackEnvelope"]] : Config.envelopes.findIndex(envelope=>envelope.name==instrumentObject["feedbackEnvelope"]);
				if (this.feedbackEnvelope == -1) this.feedbackEnvelope = 0;
				
				for (let j: number = 0; j < Config.operatorCount; j++) {
					const operator: Operator = this.operators[j];
					let operatorObject: any = undefined;
					if (instrumentObject["operators"]) operatorObject = instrumentObject["operators"][j];
					if (operatorObject == undefined) operatorObject = {};
					
					operator.frequency = Config.operatorFrequencies.findIndex(freq=>freq.name==operatorObject["frequency"]);
					if (operator.frequency == -1) operator.frequency = 0;
					if (operatorObject["amplitude"] != undefined) {
						operator.amplitude = clamp(0, Config.operatorAmplitudeMax + 1, operatorObject["amplitude"] | 0);
					} else {
						operator.amplitude = 0;
					}
					operator.envelope = legacyEnvelopeNames[operatorObject["envelope"]] != undefined ? legacyEnvelopeNames[operatorObject["envelope"]] : Config.envelopes.findIndex(envelope=>envelope.name==operatorObject["envelope"]);
					if (operator.envelope == -1) operator.envelope = 0;
				}
			} else {
				throw new Error("Unrecognized instrument type.");
			}
		}
		
		public static frequencyFromPitch(pitch: number): number {
			return 440.0 * Math.pow(2.0, (pitch - 69.0) / 12.0);
		}
		
		public static drumsetIndexReferenceDelta(index: number): number {
			return Instrument.frequencyFromPitch(Config.spectrumBasePitch + index * 6) / 44100;
		}
		
		private static _drumsetIndexToSpectrumOctave(index: number) {
			return 15 + Math.log2(Instrument.drumsetIndexReferenceDelta(index));
		}
		
		public warmUp(samplesPerSecond: number): void {
			if (this.type == InstrumentType.noise) {
				getDrumWave(this.chipNoise, inverseRealFourierTransform, scaleElementsByFactor);
			} else if (this.type == InstrumentType.harmonics) {
				this.harmonicsWave.getCustomWave();
			} else if (this.type == InstrumentType.guitar) {
				GuitarImpulseWave.getWave();
			} else if (this.type == InstrumentType.spectrum) {
				this.spectrumWave.getCustomWave(8);
			} else if (this.type == InstrumentType.drumset) {
				for (let i: number = 0; i < Config.drumCount; i++) {
					this.drumsetSpectrumWaves[i].getCustomWave(Instrument._drumsetIndexToSpectrumOctave(i));
				}
			}
		}
		
		public getDrumWave(): Float32Array {
			if (this.type == InstrumentType.noise) {
				return getDrumWave(this.chipNoise, inverseRealFourierTransform, scaleElementsByFactor);
			} else if (this.type == InstrumentType.spectrum) {
				return this.spectrumWave.getCustomWave(8);
			} else {
				throw new Error("Unhandled instrument type in getDrumWave");
			}
		}
		
		public getDrumsetWave(pitch: number): Float32Array {
			if (this.type == InstrumentType.drumset) {
				return this.drumsetSpectrumWaves[pitch].getCustomWave(Instrument._drumsetIndexToSpectrumOctave(pitch));
			} else {
				throw new Error("Unhandled instrument type in getDrumsetWave");
			}
		}
		
		public getTransition(): Transition {
			return this.type == InstrumentType.drumset ? Config.transitions.dictionary["hard fade"] : Config.transitions[this.transition];
		}
		public getChord(): Chord {
			return this.type == InstrumentType.drumset ? Config.chords.dictionary["harmony"] : Config.chords[this.chord];
		}
		public getFilterEnvelope(): Envelope {
			if (this.type == InstrumentType.drumset) throw new Error("Can't getFilterEnvelope() for drumset.");
			return Config.envelopes[this.filterEnvelope];
		}
		public getDrumsetEnvelope(pitch: number): Envelope {
			if (this.type != InstrumentType.drumset) throw new Error("Can't getDrumsetEnvelope() for non-drumset.");
			return Config.envelopes[this.drumsetEnvelopes[pitch]];
		}
	}
	
	export class Channel {
		public octave: number = 0;
		public readonly instruments: Instrument[] = [];
		public readonly patterns: Pattern[] = [];
		public readonly bars: number[] = [];
		public muted: boolean = false;
	}
	
	export class Song {
		private static readonly _format: string = "BeepBox";
		private static readonly _oldestVersion: number = 2;
		private static readonly _latestVersion: number = 9;
		
		public scale: number;
		public key: number;
		public tempo: number;
		public beatsPerBar: number;
		public barCount: number;
		public patternsPerChannel: number;
		public rhythm: number;
		public instrumentsPerChannel: number;
		public loopStart: number;
		public loopLength: number;
		public pitchChannelCount: number;
		public noiseChannelCount: number;
		public readonly channels: Channel[] = [];
		
		constructor(string?: string) {
			if (string != undefined) {
				this.fromBase64String(string);
			} else {
				this.initToDefault(true);
			}
		}
		
		public getChannelCount(): number {
			return this.pitchChannelCount + this.noiseChannelCount;
		}
		
		public getChannelIsNoise(channel: number): boolean {
			return (channel >= this.pitchChannelCount);
		}
		
		public initToDefault(andResetChannels: boolean = true): void {
			this.scale = 0;
			this.key = 0;
			this.loopStart = 0;
			this.loopLength = 4;
			this.tempo = 150;
			this.beatsPerBar = 8;
			this.barCount = 16;
			this.patternsPerChannel = 8;
			this.rhythm = 1;
			this.instrumentsPerChannel = 1;
			
			if (andResetChannels) {
				this.pitchChannelCount = 3;
				this.noiseChannelCount = 1;
				for (let channelIndex: number = 0; channelIndex < this.getChannelCount(); channelIndex++) {
					if (this.channels.length <= channelIndex) {
						this.channels[channelIndex] = new Channel();
					}
					const channel: Channel = this.channels[channelIndex];
					channel.octave = 3 - channelIndex; // [3, 2, 1, 0]; Descending octaves with drums at zero in last channel.
				
					for (let pattern: number = 0; pattern < this.patternsPerChannel; pattern++) {
						if (channel.patterns.length <= pattern) {
							channel.patterns[pattern] = new Pattern();
						} else {
							channel.patterns[pattern].reset();
						}
					}
					channel.patterns.length = this.patternsPerChannel;
				
					const isNoiseChannel: boolean = channelIndex >= this.pitchChannelCount;
					for (let instrument: number = 0; instrument < this.instrumentsPerChannel; instrument++) {
						if (channel.instruments.length <= instrument) {
							channel.instruments[instrument] = new Instrument(isNoiseChannel);
						}
						channel.instruments[instrument].setTypeAndReset(isNoiseChannel ? InstrumentType.noise : InstrumentType.chip, isNoiseChannel);
					}
					channel.instruments.length = this.instrumentsPerChannel;
				
					for (let bar: number = 0; bar < this.barCount; bar++) {
						channel.bars[bar] = bar < 4 ? 1 : 0;
					}
					channel.bars.length = this.barCount;
				}
				this.channels.length = this.getChannelCount();
			}
		}
		
		public toBase64String(): string {
			let bits: BitFieldWriter;
			let buffer: number[] = [];
			
			buffer.push(base64IntToCharCode[Song._latestVersion]);
			buffer.push(SongTagCode.channelCount, base64IntToCharCode[this.pitchChannelCount], base64IntToCharCode[this.noiseChannelCount]);
			buffer.push(SongTagCode.scale, base64IntToCharCode[this.scale]);
			buffer.push(SongTagCode.key, base64IntToCharCode[this.key]);
			buffer.push(SongTagCode.loopStart, base64IntToCharCode[this.loopStart >> 6], base64IntToCharCode[this.loopStart & 0x3f]);
			buffer.push(SongTagCode.loopEnd, base64IntToCharCode[(this.loopLength - 1) >> 6], base64IntToCharCode[(this.loopLength - 1) & 0x3f]);
			buffer.push(SongTagCode.tempo, base64IntToCharCode[this.tempo >> 6], base64IntToCharCode[this.tempo & 63]);
			buffer.push(SongTagCode.beatCount, base64IntToCharCode[this.beatsPerBar - 1]);
			buffer.push(SongTagCode.barCount, base64IntToCharCode[(this.barCount - 1) >> 6], base64IntToCharCode[(this.barCount - 1) & 0x3f]);
			buffer.push(SongTagCode.patternCount, base64IntToCharCode[(this.patternsPerChannel - 1) >> 6], base64IntToCharCode[(this.patternsPerChannel - 1) & 0x3f]);
			buffer.push(SongTagCode.instrumentCount, base64IntToCharCode[this.instrumentsPerChannel - 1]);
			buffer.push(SongTagCode.rhythm, base64IntToCharCode[this.rhythm]);
			
			buffer.push(SongTagCode.channelOctave);
			for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
				buffer.push(base64IntToCharCode[this.channels[channel].octave]);
			}
			
			for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
				for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
					const instrument: Instrument = this.channels[channel].instruments[i];
					buffer.push(SongTagCode.startInstrument, base64IntToCharCode[instrument.type]);
					buffer.push(SongTagCode.volume, base64IntToCharCode[instrument.volume]);
					buffer.push(SongTagCode.preset, base64IntToCharCode[instrument.preset >> 6], base64IntToCharCode[instrument.preset & 63]);
					buffer.push(SongTagCode.effects, base64IntToCharCode[instrument.effects >> 6], base64IntToCharCode[instrument.effects & 63]);
					
					buffer.push(SongTagCode.filter, base64IntToCharCode[instrument.filter.controlPointCount]);
					for (let j: number = 0; j < instrument.filter.controlPointCount; j++) {
						const point: FilterControlPoint = instrument.filter.controlPoints[j];
						buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[point.freq], base64IntToCharCode[point.gain]);
					}
					
					if (effectsIncludeDistortion(instrument.effects)) {
						buffer.push(SongTagCode.distortion, base64IntToCharCode[instrument.distortion]);
						buffer.push(SongTagCode.distortionFilter, base64IntToCharCode[instrument.distortionFilter.controlPointCount]);
						for (let j: number = 0; j < instrument.distortionFilter.controlPointCount; j++) {
							const point: FilterControlPoint = instrument.distortionFilter.controlPoints[j];
							buffer.push(base64IntToCharCode[point.type], base64IntToCharCode[point.freq], base64IntToCharCode[point.gain]);
						}
					}
					if (effectsIncludeBitcrusher(instrument.effects)) {
						buffer.push(SongTagCode.bitcrusher, base64IntToCharCode[instrument.bitcrusherFreq], base64IntToCharCode[instrument.bitcrusherQuantization]);
					}
					if (effectsIncludePanning(instrument.effects)) {
						buffer.push(SongTagCode.pan, base64IntToCharCode[instrument.pan]);
					}
					if (effectsIncludeReverb(instrument.effects)) {
						buffer.push(SongTagCode.reverb, base64IntToCharCode[instrument.reverb]);
					}
					
					if (instrument.type != InstrumentType.drumset) {
						buffer.push(SongTagCode.transition, base64IntToCharCode[instrument.transition]);
						buffer.push(SongTagCode.filterEnvelope, base64IntToCharCode[instrument.filterEnvelope]);
						buffer.push(SongTagCode.chord, base64IntToCharCode[instrument.chord]);
					}
					
					if (instrument.type == InstrumentType.chip) {
						buffer.push(SongTagCode.wave, base64IntToCharCode[instrument.chipWave]);
						buffer.push(SongTagCode.vibrato, base64IntToCharCode[instrument.vibrato]);
						buffer.push(SongTagCode.interval, base64IntToCharCode[instrument.interval]);
					} else if (instrument.type == InstrumentType.fm) {
						buffer.push(SongTagCode.vibrato, base64IntToCharCode[instrument.vibrato]);
						buffer.push(SongTagCode.algorithm, base64IntToCharCode[instrument.algorithm]);
						buffer.push(SongTagCode.feedbackType, base64IntToCharCode[instrument.feedbackType]);
						buffer.push(SongTagCode.feedbackAmplitude, base64IntToCharCode[instrument.feedbackAmplitude]);
						buffer.push(SongTagCode.feedbackEnvelope, base64IntToCharCode[instrument.feedbackEnvelope]);
						
						buffer.push(SongTagCode.operatorFrequencies);
						for (let o: number = 0; o < Config.operatorCount; o++) {
							buffer.push(base64IntToCharCode[instrument.operators[o].frequency]);
						}
						buffer.push(SongTagCode.operatorAmplitudes);
						for (let o: number = 0; o < Config.operatorCount; o++) {
							buffer.push(base64IntToCharCode[instrument.operators[o].amplitude]);
						}
						buffer.push(SongTagCode.operatorEnvelopes);
						for (let o: number = 0; o < Config.operatorCount; o++) {
							buffer.push(base64IntToCharCode[instrument.operators[o].envelope]);
						}
					} else if (instrument.type == InstrumentType.noise) {
						buffer.push(SongTagCode.wave, base64IntToCharCode[instrument.chipNoise]);
					} else if (instrument.type == InstrumentType.spectrum) {
						buffer.push(SongTagCode.spectrum);
						const spectrumBits: BitFieldWriter = new BitFieldWriter();
						for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
							spectrumBits.write(Config.spectrumControlPointBits, instrument.spectrumWave.spectrum[i]);
						}
						spectrumBits.encodeBase64(buffer);
					} else if (instrument.type == InstrumentType.drumset) {
						buffer.push(SongTagCode.filterEnvelope);
						for (let j: number = 0; j < Config.drumCount; j++) {
							buffer.push(base64IntToCharCode[instrument.drumsetEnvelopes[j]]);
						}
						
						buffer.push(SongTagCode.spectrum);
						const spectrumBits: BitFieldWriter = new BitFieldWriter();
						for (let j: number = 0; j < Config.drumCount; j++) {
							for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
								spectrumBits.write(Config.spectrumControlPointBits, instrument.drumsetSpectrumWaves[j].spectrum[i]);
							}
						}
						spectrumBits.encodeBase64(buffer);
					} else if (instrument.type == InstrumentType.harmonics) {
						buffer.push(SongTagCode.vibrato, base64IntToCharCode[instrument.vibrato]);
						buffer.push(SongTagCode.interval, base64IntToCharCode[instrument.interval]);
						
						buffer.push(SongTagCode.harmonics);
						const harmonicsBits: BitFieldWriter = new BitFieldWriter();
						for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
							harmonicsBits.write(Config.harmonicsControlPointBits, instrument.harmonicsWave.harmonics[i]);
						}
						harmonicsBits.encodeBase64(buffer);
					} else if (instrument.type == InstrumentType.pwm) {
						buffer.push(SongTagCode.vibrato, base64IntToCharCode[instrument.vibrato]);
						// TODO: The envelope should be saved separately.
						buffer.push(SongTagCode.pulseWidth, base64IntToCharCode[instrument.pulseWidth], base64IntToCharCode[instrument.pulseEnvelope]);
					} else if (instrument.type == InstrumentType.guitar) {
						buffer.push(SongTagCode.pulseWidth, base64IntToCharCode[instrument.pulseWidth]);
						buffer.push(SongTagCode.vibrato, base64IntToCharCode[instrument.vibrato]);
						buffer.push(SongTagCode.sustain, base64IntToCharCode[instrument.sustain]);
					} else {
						throw new Error("Unknown instrument type.");
					}
				}
			}
			
			buffer.push(SongTagCode.bars);
			bits = new BitFieldWriter();
			let neededBits: number = 0;
			while ((1 << neededBits) < this.patternsPerChannel + 1) neededBits++;
			for (let channel: number = 0; channel < this.getChannelCount(); channel++) for (let i: number = 0; i < this.barCount; i++) {
				bits.write(neededBits, this.channels[channel].bars[i]);
			}
			bits.encodeBase64(buffer);
			
			buffer.push(SongTagCode.patterns);
			bits = new BitFieldWriter();
			const shapeBits: BitFieldWriter = new BitFieldWriter();
			let neededInstrumentBits: number = 0;
			while ((1 << neededInstrumentBits) < this.instrumentsPerChannel) neededInstrumentBits++;
			for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
				const isNoiseChannel: boolean = this.getChannelIsNoise(channel);
				const octaveOffset: number = isNoiseChannel ? 0 : this.channels[channel].octave * 12;
				let lastPitch: number = (isNoiseChannel ? 4 : 12) + octaveOffset;
				const recentPitches: number[] = isNoiseChannel ? [4,6,7,2,3,8,0,10] : [12, 19, 24, 31, 36, 7, 0];
				const recentShapes: string[] = [];
				for (let i: number = 0; i < recentPitches.length; i++) {
					recentPitches[i] += octaveOffset;
				}
				for (const pattern of this.channels[channel].patterns) {
					bits.write(neededInstrumentBits, pattern.instrument);
					
					if (pattern.notes.length > 0) {
						bits.write(1, 1);
						
						let curPart: number = 0;
						for (const note of pattern.notes) {
							if (note.start > curPart) {
								bits.write(2, 0); // rest
								bits.writePartDuration(note.start - curPart);
							}
							
							shapeBits.clear();
							
							// 0: 1 pitch, 10: 2 pitches, 110: 3 pitches, 111: 4 pitches
							for (let i: number = 1; i < note.pitches.length; i++) shapeBits.write(1,1);
							if (note.pitches.length < Config.maxChordSize) shapeBits.write(1,0);
							
							shapeBits.writePinCount(note.pins.length - 1);
							
							shapeBits.write(2, note.pins[0].expression);
							
							let shapePart: number = 0;
							let startPitch: number = note.pitches[0];
							let currentPitch: number = startPitch;
							const pitchBends: number[] = [];
							for (let i: number = 1; i < note.pins.length; i++) {
								const pin: NotePin = note.pins[i];
								const nextPitch: number = startPitch + pin.interval;
								if (currentPitch != nextPitch) {
									shapeBits.write(1, 1);
									pitchBends.push(nextPitch);
									currentPitch = nextPitch;
								} else {
									shapeBits.write(1, 0);
								}
								shapeBits.writePartDuration(pin.time - shapePart);
								shapePart = pin.time;
								shapeBits.write(2, pin.expression);
							}
							
							const shapeString: string = String.fromCharCode.apply(null, shapeBits.encodeBase64([]));
							const shapeIndex: number = recentShapes.indexOf(shapeString);
							if (shapeIndex == -1) {
								bits.write(2, 1); // new shape
								bits.concat(shapeBits);
							} else {
								bits.write(1, 1); // old shape
								bits.writeLongTail(0, 0, shapeIndex);
								recentShapes.splice(shapeIndex, 1);
							}
							recentShapes.unshift(shapeString);
							if (recentShapes.length > 10) recentShapes.pop();
							
							const allPitches: number[] = note.pitches.concat(pitchBends);
							for (let i: number = 0; i < allPitches.length; i++) {
								const pitch: number = allPitches[i];
								const pitchIndex: number = recentPitches.indexOf(pitch);
								if (pitchIndex == -1) {
									let interval: number = 0;
									let pitchIter: number = lastPitch;
									if (pitchIter < pitch) {
										while (pitchIter != pitch) {
											pitchIter++;
											if (recentPitches.indexOf(pitchIter) == -1) interval++;
										}
									} else {
										while (pitchIter != pitch) {
											pitchIter--;
											if (recentPitches.indexOf(pitchIter) == -1) interval--;
										}
									}
									bits.write(1, 0);
									bits.writePitchInterval(interval);
								} else {
									bits.write(1, 1);
									bits.write(3, pitchIndex);
									recentPitches.splice(pitchIndex, 1);
								}
								recentPitches.unshift(pitch);
								if (recentPitches.length > 8) recentPitches.pop();
								
								if (i == note.pitches.length - 1) {
									lastPitch = note.pitches[0];
								} else {
									lastPitch = pitch;
								}
							}
							curPart = note.end;
						}
						
						if (curPart < this.beatsPerBar * Config.partsPerBeat) {
							bits.write(2, 0); // rest
							bits.writePartDuration(this.beatsPerBar * Config.partsPerBeat - curPart);
						}
					} else {
						bits.write(1, 0);
					}
				}
			}
			let stringLength: number = bits.lengthBase64();
			let digits: number[] = [];
			while (stringLength > 0) {
				digits.unshift(base64IntToCharCode[stringLength & 0x3f]);
				stringLength = stringLength >> 6;
			}
			buffer.push(base64IntToCharCode[digits.length]);
			Array.prototype.push.apply(buffer, digits); // append digits to buffer.
			bits.encodeBase64(buffer);
			
			const maxApplyArgs: number = 64000;
			if (buffer.length < maxApplyArgs) {
				// Note: Function.apply may break for long argument lists. 
				return String.fromCharCode.apply(null, buffer);
			} else {
				let result: string = "";
				for (let i: number = 0; i < buffer.length; i += maxApplyArgs) {
					result += String.fromCharCode.apply(null, buffer.slice(i, i + maxApplyArgs));
				}
				return result;
			}
		}
		
		public fromBase64String(compressed: string): void {
			if (compressed == null || compressed == "") {
				this.initToDefault(true);
				return;
			}
			let charIndex: number = 0;
			// skip whitespace.
			while (compressed.charCodeAt(charIndex) <= CharCode.SPACE) charIndex++;
			// skip hash mark.
			if (compressed.charCodeAt(charIndex) == CharCode.HASH) charIndex++;
			// if it starts with curly brace, treat it as JSON.
			if (compressed.charCodeAt(charIndex) == CharCode.LEFT_CURLY_BRACE) {
				this.fromJsonObject(JSON.parse(charIndex == 0 ? compressed : compressed.substring(charIndex)));
				return;
			}
			
			const version: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
			if (version == -1 || version > Song._latestVersion || version < Song._oldestVersion) return;
			const beforeThree: boolean = version < 3;
			const beforeFour:  boolean = version < 4;
			const beforeFive:  boolean = version < 5;
			const beforeSix:   boolean = version < 6;
			const beforeSeven: boolean = version < 7;
			const beforeEight: boolean = version < 8;
			const beforeNine:  boolean = version < 9;
			this.initToDefault(beforeSix);
			
			if (beforeThree) {
				// Originally, the only instrument transition was "seamless" and the only drum wave was "retro".
				for (const channel of this.channels) channel.instruments[0].transition = 0;
				this.channels[3].instruments[0].chipNoise = 0;
			}
			
			interface LegacyFilterSettings { cutoff?: number; resonance?: number; }
			let legacyFilterSettings: LegacyFilterSettings[][] | null = null;
			if (beforeNine) {
				// Unfortunately, old versions of BeepBox had a variety of different ways of
				// saving filter-related parameters in the URL, and none of them directly
				// correspond to the new way of saving filter parameters. We can approximate
				// old filters by collecting all the old settings for an instrument and
				// passing them to convertLegacySettings(), so I use this data structure to
				// collect the settings for each instrument if necessary.
				legacyFilterSettings = [];
				for (let i: number = legacyFilterSettings.length; i < this.getChannelCount(); i++) {
					legacyFilterSettings[i] = [];
					for (let j: number = 0; j < this.instrumentsPerChannel; j++) legacyFilterSettings[i][j] = {};
				}
			}
			
			let legacyGlobalReverb: number = 0; // beforeNine reverb was song-global, record that reverb here and adapt it to instruments as needed.
			
			let instrumentChannelIterator: number = 0;
			let instrumentIndexIterator: number = -1;
			let command: SongTagCode;
			while (charIndex < compressed.length) switch(command = compressed.charCodeAt(charIndex++)) {
				case SongTagCode.channelCount: {
					this.pitchChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					this.noiseChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					this.pitchChannelCount = validateRange(Config.pitchChannelCountMin, Config.pitchChannelCountMax, this.pitchChannelCount);
					this.noiseChannelCount = validateRange(Config.noiseChannelCountMin, Config.noiseChannelCountMax, this.noiseChannelCount);
					for (let channelIndex = this.channels.length; channelIndex < this.getChannelCount(); channelIndex++) {
						this.channels[channelIndex] = new Channel();
					}
					this.channels.length = this.getChannelCount();
					if (beforeNine) {
						for (let i: number = legacyFilterSettings!.length; i < this.getChannelCount(); i++) {
							legacyFilterSettings![i] = [];
							for (let j: number = 0; j < this.instrumentsPerChannel; j++) legacyFilterSettings![i][j] = {};
						}
					}
				} break;
				case SongTagCode.scale: {
					this.scale = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					if (beforeThree && this.scale == 10) this.scale = 11;
				} break;
				case SongTagCode.key: {
					if (beforeSeven) {
						this.key = clamp(0, Config.keys.length, 11 - base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					} else {
						this.key = clamp(0, Config.keys.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.loopStart: {
					if (beforeFive) {
						this.loopStart = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					} else {
						this.loopStart = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					}
				} break;
				case SongTagCode.loopEnd: {
					if (beforeFive) {
						this.loopLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					} else {
						this.loopLength = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					}
				} break;
				case SongTagCode.tempo: {
					if (beforeFour) {
						this.tempo = [95, 120, 151, 190][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
					} else if (beforeSeven) {
						this.tempo = [88, 95, 103, 111, 120, 130, 140, 151, 163, 176, 190, 206, 222, 240, 259][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
					} else {
						this.tempo = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
					this.tempo = clamp(Config.tempoMin, Config.tempoMax + 1, this.tempo);
				} break;
				case SongTagCode.reverb: {
					if (beforeNine) {
						legacyGlobalReverb = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						legacyGlobalReverb = clamp(0, 4, legacyGlobalReverb);
					} else {
						const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
						instrument.reverb = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						instrument.reverb = clamp(0, Config.reverbRange, instrument.reverb);
					}
				} break;
				case SongTagCode.beatCount: {
					if (beforeThree) {
						this.beatsPerBar = [6, 7, 8, 9, 10][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
					} else {
						this.beatsPerBar = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					}
					this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, this.beatsPerBar));
				} break;
				case SongTagCode.barCount: {
					const barCount: number = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					this.barCount = validateRange(Config.barCountMin, Config.barCountMax, barCount);
					for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
						for (let bar = this.channels[channel].bars.length; bar < this.barCount; bar++) {
							this.channels[channel].bars[bar] = 1;
						}
						this.channels[channel].bars.length = this.barCount;
					}
				} break;
				case SongTagCode.patternCount: {
					let patternsPerChannel: number;
					if (beforeEight) {
						patternsPerChannel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					} else {
						patternsPerChannel = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					}
					this.patternsPerChannel = validateRange(1, Config.barCountMax, patternsPerChannel);
					for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
						for (let pattern = this.channels[channel].patterns.length; pattern < this.patternsPerChannel; pattern++) {
							this.channels[channel].patterns[pattern] = new Pattern();
						}
						this.channels[channel].patterns.length = this.patternsPerChannel;
					}
				} break;
				case SongTagCode.instrumentCount: {
					const instrumentsPerChannel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
					this.instrumentsPerChannel = validateRange(Config.instrumentsPerChannelMin, Config.instrumentsPerChannelMax, instrumentsPerChannel);
					for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
						const isNoiseChannel: boolean = channel >= this.pitchChannelCount;
						for (let instrumentIndex: number = this.channels[channel].instruments.length; instrumentIndex < this.instrumentsPerChannel; instrumentIndex++) {
							this.channels[channel].instruments[instrumentIndex] = new Instrument(isNoiseChannel);
						}
						this.channels[channel].instruments.length = this.instrumentsPerChannel;
						if (beforeSix) {
							for (let instrumentIndex: number = 0; instrumentIndex < this.instrumentsPerChannel; instrumentIndex++) {
								this.channels[channel].instruments[instrumentIndex].setTypeAndReset(isNoiseChannel ? InstrumentType.noise : InstrumentType.chip, isNoiseChannel);
							}
						}
						if (beforeNine) {
							for (let j: number = legacyFilterSettings![channel].length; j < this.instrumentsPerChannel; j++) legacyFilterSettings![channel][j] = {};
						}
					}
				} break;
				case SongTagCode.rhythm: {
					this.rhythm = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
				} break;
				case SongTagCode.channelOctave: {
					if (beforeThree) {
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						this.channels[channel].octave = clamp(0, Config.scrollableOctaves + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					} else {
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							this.channels[channel].octave = clamp(0, Config.scrollableOctaves + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						}
					}
				} break;
				case SongTagCode.startInstrument: {
					instrumentIndexIterator++;
					if (instrumentIndexIterator >= this.instrumentsPerChannel) {
						instrumentChannelIterator++;
						instrumentIndexIterator = 0;
					}
					validateRange(0, this.channels.length - 1, instrumentChannelIterator);
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					const instrumentType: number = validateRange(0, InstrumentType.length - 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					instrument.setTypeAndReset(instrumentType, instrumentChannelIterator >= this.pitchChannelCount);
					
					if (beforeSeven) {
						// the reverb effect was applied to all pitched instruments if nonzero but never explicitly enabled if beforeSeven, so enable it here.
						if (legacyGlobalReverb > 0 && !this.getChannelIsNoise(instrumentChannelIterator)) {
							instrument.effects = (1 << EffectType.reverb);
							instrument.reverb = legacyGlobalReverb;
						} else {
							instrument.effects = 0;
						}
					}
				} break;
				case SongTagCode.preset: {
					const presetValue: number = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].preset = presetValue;
				} break;
				case SongTagCode.wave: {
					if (beforeThree) {
						const legacyWaves: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						const instrument: Instrument = this.channels[channel].instruments[0];
						instrument.chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);
						
						// Version 2 didn't save any settings for settings for filters,
						// just waves, so initialize the filters here I guess.
						instrument.filter.convertLegacySettings(undefined, undefined, Config.envelopes[instrument.filterEnvelope], instrument.type);
						
					} else if (beforeSix) {
						const legacyWaves: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
								if (channel >= this.pitchChannelCount) {
									this.channels[channel].instruments[i].chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
								} else {
									this.channels[channel].instruments[i].chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);
								}
							}
						}
					} else if (beforeSeven) {
						const legacyWaves: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
						if (instrumentChannelIterator >= this.pitchChannelCount) {
							this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						} else {
							this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, legacyWaves[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]] | 0);
						}
					} else {
						if (instrumentChannelIterator >= this.pitchChannelCount) {
							this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipNoise = clamp(0, Config.chipNoises.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						} else {
							this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chipWave = clamp(0, Config.chipWaves.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						}
					}
				} break;
				case SongTagCode.filter: {
					if (beforeNine) {
						if (beforeSeven) {
							const legacyToCutoff: number[] = [10, 6, 3, 0, 8, 5, 2];
							const legacyToEnvelope: number[] = [1, 1, 1, 1, 18, 19, 20];
							const filterNames: string[] = ["none", "bright", "medium", "soft", "decay bright", "decay medium", "decay soft"];
							
							if (beforeThree) {
								const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
								const instrument: Instrument = this.channels[channel].instruments[0];
								const legacySettings: LegacyFilterSettings = legacyFilterSettings![channel][0];
								const legacyFilter: number = [1, 3, 4, 5][clamp(0, filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
								legacySettings.cutoff = legacyToCutoff[legacyFilter];
								legacySettings.resonance = 0;
								instrument.filterEnvelope = legacyToEnvelope[legacyFilter];
								instrument.filter.convertLegacySettings(legacySettings.cutoff, legacySettings.resonance, Config.envelopes[instrument.filterEnvelope], instrument.type);
							} else if (beforeSix) {
								for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
									for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
										const instrument: Instrument = this.channels[channel].instruments[i];
										const legacyFilter: number = clamp(0, filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1);
										const legacySettings: LegacyFilterSettings = legacyFilterSettings![channel][i];
										if (channel < this.pitchChannelCount) {
											legacySettings.cutoff = legacyToCutoff[legacyFilter];
											legacySettings.resonance = 0;
											instrument.filterEnvelope = legacyToEnvelope[legacyFilter];
										} else {
											legacySettings.cutoff = 10;
											legacySettings.resonance = 0;
											instrument.filterEnvelope = 1;
										}
										instrument.filter.convertLegacySettings(legacySettings.cutoff, legacySettings.resonance, Config.envelopes[instrument.filterEnvelope], instrument.type);
									}
								}
							} else {
								const legacyFilter: number = clamp(0, filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
								const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
								const legacySettings: LegacyFilterSettings = legacyFilterSettings![instrumentChannelIterator][instrumentIndexIterator];
								legacySettings.cutoff = legacyToCutoff[legacyFilter];
								legacySettings.resonance = 0;
								instrument.filterEnvelope = legacyToEnvelope[legacyFilter];
								instrument.filter.convertLegacySettings(legacySettings.cutoff, legacySettings.resonance, Config.envelopes[instrument.filterEnvelope], instrument.type);
							}
						} else {
							const filterCutoffRange: number = 11;
							const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
							const legacySettings: LegacyFilterSettings = legacyFilterSettings![instrumentChannelIterator][instrumentIndexIterator];
							legacySettings.cutoff = clamp(0, filterCutoffRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
							instrument.filter.convertLegacySettings(legacySettings.cutoff, legacySettings.resonance, Config.envelopes[instrument.filterEnvelope], instrument.type);
						}
					} else {
						const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
						const originalControlPointCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						instrument.filter.controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalControlPointCount);
						for (let i: number = instrument.filter.controlPoints.length; i < instrument.filter.controlPointCount; i++) {
							instrument.filter.controlPoints[i] = new FilterControlPoint();
						}
						for (let i: number = 0; i < instrument.filter.controlPointCount; i++) {
							const point: FilterControlPoint = instrument.filter.controlPoints[i];
							point.type = clamp(0, FilterType.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
							point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
							point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						}
						for (let i: number = instrument.filter.controlPointCount; i < originalControlPointCount; i++) {
							charIndex += 3;
						}
					}
				} break;
				case SongTagCode.filterResonance: {
					if (beforeNine) {
						const filterResonanceRange: number = 8;
						const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
						const legacySettings: LegacyFilterSettings = legacyFilterSettings![instrumentChannelIterator][instrumentIndexIterator];
						legacySettings.resonance = clamp(0, filterResonanceRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						instrument.filter.convertLegacySettings(legacySettings.cutoff, legacySettings.resonance, Config.envelopes[instrument.filterEnvelope], instrument.type);
					} else {
						// Do nothing? This song tag code is deprecated for now.
					}
				} break;
				case SongTagCode.distortionFilter: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					const originalControlPointCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					instrument.distortionFilter.controlPointCount = clamp(0, Config.filterMaxPoints + 1, originalControlPointCount);
					for (let i: number = instrument.distortionFilter.controlPoints.length; i < instrument.distortionFilter.controlPointCount; i++) {
						instrument.distortionFilter.controlPoints[i] = new FilterControlPoint();
					}
					for (let i: number = 0; i < instrument.distortionFilter.controlPointCount; i++) {
						const point: FilterControlPoint = instrument.distortionFilter.controlPoints[i];
						point.type = clamp(0, FilterType.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						point.freq = clamp(0, Config.filterFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						point.gain = clamp(0, Config.filterGainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
					for (let i: number = instrument.distortionFilter.controlPointCount; i < originalControlPointCount; i++) {
						charIndex += 3;
					}
				} break;
				case SongTagCode.filterEnvelope: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					if (instrument.type == InstrumentType.drumset) {
						for (let i: number = 0; i < Config.drumCount; i++) {
							instrument.drumsetEnvelopes[i] = clamp(0, Config.envelopes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						}
					} else {
						instrument.filterEnvelope = clamp(0, Config.envelopes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
					
					if (beforeNine) {
						// The presence of an envelope affects how convertLegacySettings
						// decides the closest possible approximation, so update it.
						const legacySettings: LegacyFilterSettings = legacyFilterSettings![instrumentChannelIterator][instrumentIndexIterator];
						instrument.filter.convertLegacySettings(legacySettings.cutoff, legacySettings.resonance, Config.envelopes[instrument.filterEnvelope], instrument.type);
					}
				} break;
				case SongTagCode.pulseWidth: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					instrument.pulseWidth = clamp(0, Config.pulseWidthRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					
					if (instrument.type == InstrumentType.pwm) {
						// TODO: The envelope should be saved separately, check beforeNine.
						instrument.pulseEnvelope = clamp(0, Config.envelopes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.distortion: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					instrument.distortion = clamp(0, Config.distortionRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.bitcrusher: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					instrument.bitcrusherFreq = clamp(0, Config.bitcrusherFreqRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					instrument.bitcrusherQuantization = clamp(0, Config.bitcrusherQuantizationRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.sustain: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					instrument.sustain = clamp(0, Config.sustainRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.transition: {
					if (beforeThree) {
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						this.channels[channel].instruments[0].transition = clamp(0, Config.transitions.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					} else if (beforeSix) {
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
								this.channels[channel].instruments[i].transition = clamp(0, Config.transitions.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
							}
						}
					} else {
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].transition = clamp(0, Config.transitions.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.vibrato: {
					if (beforeThree) {
						const legacyEffects: number[] = [0, 3, 2, 0];
						const legacyEnvelopes: number[] = [1, 1, 1, 13];
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						const effect: number = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						const instrument: Instrument = this.channels[channel].instruments[0];
						instrument.vibrato = legacyEffects[effect];
						instrument.filterEnvelope = (instrument.filterEnvelope == 1)
							? legacyEnvelopes[effect]
							: instrument.filterEnvelope;
					} else if (beforeSix) {
						const legacyEffects: number[] = [0, 1, 2, 3, 0, 0];
						const legacyEnvelopes: number[] = [1, 1, 1, 1, 16, 13];
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
								const effect: number = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
								const instrument: Instrument = this.channels[channel].instruments[i];
								instrument.vibrato = legacyEffects[effect];
								instrument.filterEnvelope = (instrument.filterEnvelope == 1)
									? legacyEnvelopes[effect]
									: instrument.filterEnvelope;
							}
						}
					} else if (beforeSeven) {
						const legacyEffects: number[] = [0, 1, 2, 3, 0, 0];
						const legacyEnvelopes: number[] = [1, 1, 1, 1, 16, 13];
						const effect: number = clamp(0, legacyEffects.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
						instrument.vibrato = legacyEffects[effect];
						instrument.filterEnvelope = (instrument.filterEnvelope == 1)
							? legacyEnvelopes[effect]
							: instrument.filterEnvelope;
					} else {
						const vibrato: number = clamp(0, Config.vibratos.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].vibrato = vibrato;
					}
				} break;
				case SongTagCode.interval: {
					if (beforeThree) {
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						this.channels[channel].instruments[0].interval = clamp(0, Config.intervals.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					} else if (beforeSix) {
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
								const originalValue: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
								let interval: number = clamp(0, Config.intervals.length, originalValue);
								if (originalValue == 8) {
									// original "custom harmony" now maps to "hum" and "custom interval".
									interval = 2;
									this.channels[channel].instruments[i].chord = 3;
								}
								this.channels[channel].instruments[i].interval = interval;
							}
						}
					} else if (beforeSeven) {
						const originalValue: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						let interval: number = clamp(0, Config.intervals.length, originalValue);
						if (originalValue == 8) {
							// original "custom harmony" now maps to "hum" and "custom interval".
							interval = 2;
							this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chord = 3;
						}
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].interval = interval;
					} else {
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].interval = clamp(0, Config.intervals.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.chord: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chord = clamp(0, Config.chords.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.effects: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					if (beforeNine) {
						instrument.effects = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] & ((1 << EffectType.length) - 1));
						if (legacyGlobalReverb == 0) {
							// Disable reverb if legacy song reverb was zero.
							instrument.effects = (instrument.effects & (~(1 << EffectType.reverb)));
						} else if (effectsIncludeReverb(instrument.effects)) {
							instrument.reverb = legacyGlobalReverb;
						}
						if (instrument.pan != Config.panCenter) {
							// Enable panning if panning slider isn't centered.
							instrument.effects = (instrument.effects | (1 << EffectType.panning));
						}
					} else {
						instrument.effects = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) | (base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
					instrument.effects = (instrument.effects & ((1 << EffectType.length) - 1));
				} break;
				case SongTagCode.volume: {
					if (beforeThree) {
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						const instrument: Instrument = this.channels[channel].instruments[0];
						instrument.volume = clamp(0, Config.volumeRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						// legacy mute value:
						if (instrument.volume == 5) instrument.volume = Config.volumeRange - 1;
					} else if (beforeSix) {
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
								const instrument: Instrument = this.channels[channel].instruments[i];
								instrument.volume = clamp(0, Config.volumeRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
								// legacy mute value:
								if (instrument.volume == 5) instrument.volume = Config.volumeRange - 1;
							}
						}
					} else if (beforeSeven) {
						const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
						instrument.volume = clamp(0, Config.volumeRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						// legacy mute value:
						if (instrument.volume == 5) instrument.volume = Config.volumeRange - 1;
					} else {
						const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
						instrument.volume = clamp(0, Config.volumeRange, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.pan: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					instrument.pan = clamp(0, Config.panMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.algorithm: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].algorithm = clamp(0, Config.algorithms.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.feedbackType: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackType = clamp(0, Config.feedbacks.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.feedbackAmplitude: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackAmplitude = clamp(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.feedbackEnvelope: {
					this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackEnvelope = clamp(0, Config.envelopes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
				} break;
				case SongTagCode.operatorFrequencies: {
					for (let o: number = 0; o < Config.operatorCount; o++) {
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].frequency = clamp(0, Config.operatorFrequencies.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.operatorAmplitudes: {
					for (let o: number = 0; o < Config.operatorCount; o++) {
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].amplitude = clamp(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.operatorEnvelopes: {
					for (let o: number = 0; o < Config.operatorCount; o++) {
						this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].envelope = clamp(0, Config.envelopes.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
					}
				} break;
				case SongTagCode.spectrum: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					if (instrument.type == InstrumentType.spectrum) {
						const byteCount: number = Math.ceil(Config.spectrumControlPoints * Config.spectrumControlPointBits / 6)
						const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + byteCount);
						for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
							instrument.spectrumWave.spectrum[i] = bits.read(Config.spectrumControlPointBits);
						}
						instrument.spectrumWave.markCustomWaveDirty();
						charIndex += byteCount;
					} else if (instrument.type == InstrumentType.drumset) {
						const byteCount: number = Math.ceil(Config.drumCount * Config.spectrumControlPoints * Config.spectrumControlPointBits / 6)
						const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + byteCount);
						for (let j: number = 0; j < Config.drumCount; j++) {
							for (let i: number = 0; i < Config.spectrumControlPoints; i++) {
								instrument.drumsetSpectrumWaves[j].spectrum[i] = bits.read(Config.spectrumControlPointBits);
							}
							instrument.drumsetSpectrumWaves[j].markCustomWaveDirty();
						}
						charIndex += byteCount;
					} else {
						throw new Error("Unhandled instrument type for spectrum song tag code.");
					}
				} break;
				case SongTagCode.harmonics: {
					const instrument: Instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
					const byteCount: number = Math.ceil(Config.harmonicsControlPoints * Config.harmonicsControlPointBits / 6)
					const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + byteCount);
					for (let i: number = 0; i < Config.harmonicsControlPoints; i++) {
						instrument.harmonicsWave.harmonics[i] = bits.read(Config.harmonicsControlPointBits);
					}
					instrument.harmonicsWave.markCustomWaveDirty();
					charIndex += byteCount;
				} break;
				case SongTagCode.bars: {
					let subStringLength: number;
					if (beforeThree) {
						const channel: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						const barCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						subStringLength = Math.ceil(barCount * 0.5);
						const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
						for (let i: number = 0; i < barCount; i++) {
							this.channels[channel].bars[i] = bits.read(3) + 1;
						}
					} else if (beforeFive) {
						let neededBits: number = 0;
						while ((1 << neededBits) < this.patternsPerChannel) neededBits++;
						subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
						const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.barCount; i++) {
								this.channels[channel].bars[i] = bits.read(neededBits) + 1;
							}
						}
					} else {
						let neededBits: number = 0;
						while ((1 << neededBits) < this.patternsPerChannel + 1) neededBits++;
						subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
						const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + subStringLength);
						for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
							for (let i: number = 0; i < this.barCount; i++) {
								this.channels[channel].bars[i] = bits.read(neededBits);
							}
						}
					}
					charIndex += subStringLength;
				} break;
				case SongTagCode.patterns: {
					let bitStringLength: number = 0;
					let channel: number;
					if (beforeThree) {
						channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						
						// The old format used the next character to represent the number of patterns in the channel, which is usually eight, the default. 
						charIndex++; //let patternCount: number = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						
						bitStringLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
						bitStringLength = bitStringLength << 6;
						bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
					} else {
						channel = 0;
						let bitStringLengthLength: number = validateRange(1, 4, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
						while (bitStringLengthLength > 0) {
							bitStringLength = bitStringLength << 6;
							bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
							bitStringLengthLength--;
						}
					}
					
					const bits: BitFieldReader = new BitFieldReader(compressed, charIndex, charIndex + bitStringLength);
					charIndex += bitStringLength;
					
					let neededInstrumentBits: number = 0;
					while ((1 << neededInstrumentBits) < this.instrumentsPerChannel) neededInstrumentBits++;
					while (true) {
						const isNoiseChannel: boolean = this.getChannelIsNoise(channel);
						
						const octaveOffset: number = isNoiseChannel ? 0 : this.channels[channel].octave * 12;
						let note: Note | null = null;
						let pin: NotePin | null = null;
						let lastPitch: number = (isNoiseChannel ? 4 : 12) + octaveOffset;
						const recentPitches: number[] = isNoiseChannel ? [4,6,7,2,3,8,0,10] : [12, 19, 24, 31, 36, 7, 0];
						const recentShapes: any[] = [];
						for (let i: number = 0; i < recentPitches.length; i++) {
							recentPitches[i] += octaveOffset;
						}
						for (let i: number = 0; i < this.patternsPerChannel; i++) {
							const newPattern: Pattern = this.channels[channel].patterns[i];
							newPattern.reset();
							newPattern.instrument = bits.read(neededInstrumentBits);
							
							if (!beforeThree && bits.read(1) == 0) continue;
							
							let curPart: number = 0;
							const newNotes: Note[] = newPattern.notes;
							while (curPart < this.beatsPerBar * Config.partsPerBeat) {
								
								const useOldShape: boolean = bits.read(1) == 1;
								let newNote: boolean = false;
								let shapeIndex: number = 0;
								if (useOldShape) {
									shapeIndex = validateRange(0, recentShapes.length - 1, bits.readLongTail(0, 0));
								} else {
									newNote = bits.read(1) == 1;
								}
								
								if (!useOldShape && !newNote) {
									const restLength: number = beforeSeven
										? bits.readLegacyPartDuration() * Config.partsPerBeat / Config.rhythms[this.rhythm].stepsPerBeat
										: bits.readPartDuration();
									curPart += restLength;
								} else {
									let shape: any;
									let pinObj: any;
									let pitch: number;
									if (useOldShape) {
										shape = recentShapes[shapeIndex];
										recentShapes.splice(shapeIndex, 1);
									} else {
										shape = {};
										
										shape.pitchCount = 1;
										while (shape.pitchCount < Config.maxChordSize && bits.read(1) == 1) shape.pitchCount++;
										
										shape.pinCount = bits.readPinCount();
										shape.initialExpression = bits.read(2);
										
										shape.pins = [];
										shape.length = 0;
										shape.bendCount = 0;
										for (let j: number = 0; j < shape.pinCount; j++) {
											pinObj = {};
											pinObj.pitchBend = bits.read(1) == 1;
											if (pinObj.pitchBend) shape.bendCount++;
											shape.length += beforeSeven
												? bits.readLegacyPartDuration() * Config.partsPerBeat / Config.rhythms[this.rhythm].stepsPerBeat
												: bits.readPartDuration();
											pinObj.time = shape.length;
											pinObj.expression = bits.read(2);
											shape.pins.push(pinObj);
										}
									}
									recentShapes.unshift(shape);
									if (recentShapes.length > 10) recentShapes.pop();
									
									note = new Note(0,curPart,curPart + shape.length, shape.initialExpression);
									note.pitches = [];
									note.pins.length = 1;
									const pitchBends: number[] = [];
									for (let j: number = 0; j < shape.pitchCount + shape.bendCount; j++) {
										const useOldPitch: boolean = bits.read(1) == 1;
										if (!useOldPitch) {
											const interval: number = bits.readPitchInterval();
											pitch = lastPitch;
											let intervalIter: number = interval;
											while (intervalIter > 0) {
												pitch++;
												while (recentPitches.indexOf(pitch) != -1) pitch++;
												intervalIter--;
											}
											while (intervalIter < 0) {
												pitch--;
												while (recentPitches.indexOf(pitch) != -1) pitch--;
												intervalIter++;
											}
										} else {
											const pitchIndex: number = validateRange(0, recentPitches.length - 1, bits.read(3));
											pitch = recentPitches[pitchIndex];
											recentPitches.splice(pitchIndex, 1);
										}
										
										recentPitches.unshift(pitch);
										if (recentPitches.length > 8) recentPitches.pop();
										
										if (j < shape.pitchCount) {
											note.pitches.push(pitch);
										} else {
											pitchBends.push(pitch);
										}
										
										if (j == shape.pitchCount - 1) {
											lastPitch = note.pitches[0];
										} else {
											lastPitch = pitch;
										}
									}
									
									pitchBends.unshift(note.pitches[0]);
									
									for (const pinObj of shape.pins) {
										if (pinObj.pitchBend) pitchBends.shift();
										pin = makeNotePin(pitchBends[0] - note.pitches[0], pinObj.time, pinObj.expression);
										note.pins.push(pin);
									}
									curPart = validateRange(0, this.beatsPerBar * Config.partsPerBeat, note.end);
									newNotes.push(note);
								}
							}
						}
						
						if (beforeThree) {
							break;
						} else {
							channel++;
							if (channel >= this.getChannelCount()) break;
						}
					} // while (true)
				} break;
				default: {
					throw new Error("Unrecognized song tag code " + String.fromCharCode(command) + " at index " + (charIndex - 1));
				} break;
			}
		}
		
		public toJsonObject(enableIntro: boolean = true, loopCount: number = 1, enableOutro: boolean = true): Object {
			const channelArray: Object[] = [];
			for (let channel: number = 0; channel < this.getChannelCount(); channel++) {
				const instrumentArray: Object[] = [];
				const isNoiseChannel: boolean = this.getChannelIsNoise(channel);
				for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
					instrumentArray.push(this.channels[channel].instruments[i].toJsonObject());
				}
				
				const patternArray: Object[] = [];
				for (const pattern of this.channels[channel].patterns) {
					const noteArray: Object[] = [];
					for (const note of pattern.notes) {
						const pointArray: Object[] = [];
						for (const pin of note.pins) {
							pointArray.push({
								"tick": (pin.time + note.start) * Config.rhythms[this.rhythm].stepsPerBeat / Config.partsPerBeat,
								"pitchBend": pin.interval,
								"volume": Math.round(pin.expression * 100 / 3),
							});
						}
						
						noteArray.push({
							"pitches": note.pitches,
							"points": pointArray,
						});
					}
					
					patternArray.push({
						"instrument": pattern.instrument + 1,
						"notes": noteArray, 
					});
				}
				
				const sequenceArray: number[] = [];
				if (enableIntro) for (let i: number = 0; i < this.loopStart; i++) {
					sequenceArray.push(this.channels[channel].bars[i]);
				}
				for (let l: number = 0; l < loopCount; l++) for (let i: number = this.loopStart; i < this.loopStart + this.loopLength; i++) {
					sequenceArray.push(this.channels[channel].bars[i]);
				}
				if (enableOutro) for (let i: number = this.loopStart + this.loopLength; i < this.barCount; i++) {
					sequenceArray.push(this.channels[channel].bars[i]);
				}
				
				channelArray.push({
					"type": isNoiseChannel ? "drum" : "pitch",
					"octaveScrollBar": this.channels[channel].octave,
					"instruments": instrumentArray,
					"patterns": patternArray,
					"sequence": sequenceArray,
				});
			}
			
			return {
				"format": Song._format,
				"version": Song._latestVersion,
				"scale": Config.scales[this.scale].name,
				"key": Config.keys[this.key].name,
				"introBars": this.loopStart,
				"loopBars": this.loopLength,
				"beatsPerBar": this.beatsPerBar,
				"ticksPerBeat": Config.rhythms[this.rhythm].stepsPerBeat,
				"beatsPerMinute": this.tempo,
				//"outroBars": this.barCount - this.loopStart - this.loopLength; // derive this from bar arrays?
				//"patternCount": this.patternsPerChannel, // derive this from pattern arrays?
				//"instrumentsPerChannel": this.instrumentsPerChannel, //derive this from instrument arrays?
				"channels": channelArray,
			};
		}
		
		public fromJsonObject(jsonObject: any): void {
			this.initToDefault(true);
			if (!jsonObject) return;
			
			//const version: number = jsonObject["version"] | 0;
			//if (version > Song._latestVersion) return; // Go ahead and try to parse something from the future I guess? JSON is pretty easy-going!
			
			this.scale = 11; // default to expert.
			if (jsonObject["scale"] != undefined) {
				const oldScaleNames: Dictionary<string> = {
					"romani :)": "dbl harmonic :)",
					"romani :(": "dbl harmonic :(",
					"enigma": "strange",
				};
				const scaleName: string = (oldScaleNames[jsonObject["scale"]] != undefined) ? oldScaleNames[jsonObject["scale"]] : jsonObject["scale"];
				const scale: number = Config.scales.findIndex(scale => scale.name == scaleName);
				if (scale != -1) this.scale = scale;
			}
			
			if (jsonObject["key"] != undefined) {
				if (typeof(jsonObject["key"]) == "number") {
					this.key = ((jsonObject["key"] + 1200) >>> 0) % Config.keys.length;
				} else if (typeof(jsonObject["key"]) == "string") {
					const key: string = jsonObject["key"];
					const letter: string = key.charAt(0).toUpperCase();
					const symbol: string = key.charAt(1).toLowerCase();
					const letterMap: Readonly<Dictionary<number>> = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11};
					const accidentalMap: Readonly<Dictionary<number>> = {"#": 1, "♯": 1, "b": -1, "♭": -1};
					let index: number | undefined = letterMap[letter];
					const offset: number | undefined = accidentalMap[symbol];
					if (index != undefined) {
						if (offset != undefined) index += offset;
						if (index < 0) index += 12;
						index = index % 12;
						this.key = index;
					}
				}
			}
			
			if (jsonObject["beatsPerMinute"] != undefined) {
				this.tempo = clamp(Config.tempoMin, Config.tempoMax + 1, jsonObject["beatsPerMinute"] | 0);
			}
			
			let legacyGlobalReverb: number = 0; // In older songs, reverb was song-global, record that here and pass it to Instrument.fromJsonObject() for context.
			if (jsonObject["reverb"] != undefined) {
				legacyGlobalReverb = clamp(0, 4, jsonObject["reverb"] | 0);
			}
			
			if (jsonObject["beatsPerBar"] != undefined) {
				this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, jsonObject["beatsPerBar"] | 0));
			}
			
			let importedPartsPerBeat: number = 4;
			if (jsonObject["ticksPerBeat"] != undefined) {
				importedPartsPerBeat = (jsonObject["ticksPerBeat"] | 0) || 4;
				this.rhythm = Config.rhythms.findIndex(rhythm=>rhythm.stepsPerBeat==importedPartsPerBeat);
				if (this.rhythm == -1) {
					this.rhythm = 1;
				}
			}
			
			let maxInstruments: number = 1;
			let maxPatterns: number = 1;
			let maxBars: number = 1;
			if (jsonObject["channels"]) {
				for (const channelObject of jsonObject["channels"]) {
					if (channelObject["instruments"]) maxInstruments = Math.max(maxInstruments, channelObject["instruments"].length | 0);
					if (channelObject["patterns"]) maxPatterns = Math.max(maxPatterns, channelObject["patterns"].length | 0);
					if (channelObject["sequence"]) maxBars = Math.max(maxBars, channelObject["sequence"].length | 0);
				}
			}
			
			this.instrumentsPerChannel = Math.min(maxInstruments, Config.instrumentsPerChannelMax);
			this.patternsPerChannel = Math.min(maxPatterns, Config.barCountMax);
			this.barCount = Math.min(maxBars, Config.barCountMax);
			
			if (jsonObject["introBars"] != undefined) {
				this.loopStart = clamp(0, this.barCount, jsonObject["introBars"] | 0);
			}
			if (jsonObject["loopBars"] != undefined) {
				this.loopLength = clamp(1, this.barCount - this.loopStart + 1, jsonObject["loopBars"] | 0);
			}
			
			const newPitchChannels: Channel[] = [];
			const newNoiseChannels: Channel[] = [];
			if (jsonObject["channels"]) {
				for (let channelIndex: number = 0; channelIndex < jsonObject["channels"].length; channelIndex++) {
					let channelObject: any = jsonObject["channels"][channelIndex];
					
					const channel: Channel = new Channel();
					
					let isNoiseChannel: boolean = false;
					if (channelObject["type"] != undefined) {
						isNoiseChannel = (channelObject["type"] == "drum");
					} else {
						// for older files, assume drums are channel 3.
						isNoiseChannel = (channelIndex >= 3);
					}
					if (isNoiseChannel) {
						newNoiseChannels.push(channel);
					} else {
						newPitchChannels.push(channel);
					}
					
					if (channelObject["octaveScrollBar"] != undefined) {
						channel.octave = clamp(0, Config.scrollableOctaves + 1, channelObject["octaveScrollBar"] | 0);
					}
					
					for (let i: number = channel.instruments.length; i < this.instrumentsPerChannel; i++) {
						channel.instruments[i] = new Instrument(isNoiseChannel);
					}
					channel.instruments.length = this.instrumentsPerChannel;
					
					for (let i: number = channel.patterns.length; i < this.patternsPerChannel; i++) {
						channel.patterns[i] = new Pattern();
					}
					channel.patterns.length = this.patternsPerChannel;
					
					for (let i: number = 0; i < this.barCount; i++) {
						channel.bars[i] = 1;
					}
					channel.bars.length = this.barCount;
					
					for (let i: number = 0; i < this.instrumentsPerChannel; i++) {
						const instrument: Instrument = channel.instruments[i];
						instrument.fromJsonObject(channelObject["instruments"][i], isNoiseChannel, legacyGlobalReverb);
					}
					
					for (let i: number = 0; i < this.patternsPerChannel; i++) {
						const pattern: Pattern = channel.patterns[i];
					
						let patternObject: any = undefined;
						if (channelObject["patterns"]) patternObject = channelObject["patterns"][i];
						if (patternObject == undefined) continue;
					
						pattern.instrument = clamp(0, this.instrumentsPerChannel, (patternObject["instrument"] | 0) - 1);
					
						if (patternObject["notes"] && patternObject["notes"].length > 0) {
							const maxNoteCount: number = Math.min(this.beatsPerBar * Config.partsPerBeat, patternObject["notes"].length >>> 0);
						
							///@TODO: Consider supporting notes specified in any timing order, sorting them and truncating as necessary. 
							let tickClock: number = 0;
							for (let j: number = 0; j < patternObject["notes"].length; j++) {
								if (j >= maxNoteCount) break;
							
								const noteObject = patternObject["notes"][j];
								if (!noteObject || !noteObject["pitches"] || !(noteObject["pitches"].length >= 1) || !noteObject["points"] || !(noteObject["points"].length >= 2)) {
									continue;
								}
							
								const note: Note = new Note(0, 0, 0, 0);
								note.pitches = [];
								note.pins = [];
							
								for (let k: number = 0; k < noteObject["pitches"].length; k++) {
									const pitch: number = noteObject["pitches"][k] | 0;
									if (note.pitches.indexOf(pitch) != -1) continue;
									note.pitches.push(pitch);
									if (note.pitches.length >= Config.maxChordSize) break;
								}
								if (note.pitches.length < 1) continue;
							
								let noteClock: number = tickClock;
								let startInterval: number = 0;
								for (let k: number = 0; k < noteObject["points"].length; k++) {
									const pointObject: any = noteObject["points"][k];
									if (pointObject == undefined || pointObject["tick"] == undefined) continue;
									const interval: number = (pointObject["pitchBend"] == undefined) ? 0 : (pointObject["pitchBend"] | 0);
									
									const time: number = Math.round((+pointObject["tick"]) * Config.partsPerBeat / importedPartsPerBeat);
									
									const expression: number = (pointObject["volume"] == undefined) ? 3 : Math.max(0, Math.min(3, Math.round((pointObject["volume"] | 0) * 3 / 100)));
								
									if (time > this.beatsPerBar * Config.partsPerBeat) continue;
									if (note.pins.length == 0) {
										if (time < noteClock) continue;
										note.start = time;
										startInterval = interval;
									} else {
										if (time <= noteClock) continue;
									}
									noteClock = time;
								
									note.pins.push(makeNotePin(interval - startInterval, time - note.start, expression));
								}
								if (note.pins.length < 2) continue;
							
								note.end = note.pins[note.pins.length - 1].time + note.start;
							
								const maxPitch: number = isNoiseChannel ? Config.drumCount - 1 : Config.maxPitch;
								let lowestPitch: number = maxPitch;
								let highestPitch: number = 0;
								for (let k: number = 0; k < note.pitches.length; k++) {
									note.pitches[k] += startInterval;
									if (note.pitches[k] < 0 || note.pitches[k] > maxPitch) {
										note.pitches.splice(k, 1);
										k--;
									}
									if (note.pitches[k] < lowestPitch) lowestPitch = note.pitches[k];
									if (note.pitches[k] > highestPitch) highestPitch = note.pitches[k];
								}
								if (note.pitches.length < 1) continue;
							
								for (let k: number = 0; k < note.pins.length; k++) {
									const pin: NotePin = note.pins[k];
									if (pin.interval + lowestPitch < 0) pin.interval = -lowestPitch;
									if (pin.interval + highestPitch > maxPitch) pin.interval = maxPitch - highestPitch;
									if (k >= 2) {
										if (pin.interval == note.pins[k-1].interval && 
											pin.interval == note.pins[k-2].interval && 
											pin.expression == note.pins[k-1].expression && 
											pin.expression == note.pins[k-2].expression)
										{
											note.pins.splice(k-1, 1);
											k--;
										}
									}
								}
							
								pattern.notes.push(note);
								tickClock = note.end;
							}
						}
					}
				
					for (let i: number = 0; i < this.barCount; i++) {
						channel.bars[i] = channelObject["sequence"] ? Math.min(this.patternsPerChannel, channelObject["sequence"][i] >>> 0) : 0;
					}
				}
			}
			
			if (newPitchChannels.length > Config.pitchChannelCountMax) newPitchChannels.length = Config.pitchChannelCountMax;
			if (newNoiseChannels.length > Config.noiseChannelCountMax) newNoiseChannels.length = Config.noiseChannelCountMax;
			this.pitchChannelCount = newPitchChannels.length;
			this.noiseChannelCount = newNoiseChannels.length;
			this.channels.length = 0;
			Array.prototype.push.apply(this.channels, newPitchChannels);
			Array.prototype.push.apply(this.channels, newNoiseChannels);
		}
		
		public getPattern(channel: number, bar: number): Pattern | null {
			if (bar < 0 || bar >= this.barCount) return null;
			const patternIndex: number = this.channels[channel].bars[bar];
			if (patternIndex == 0) return null;
			return this.channels[channel].patterns[patternIndex - 1];
		}
		
		public getPatternInstrument(channel: number, bar: number): number {
			const pattern: Pattern | null = this.getPattern(channel, bar);
			return pattern == null ? 0 : pattern.instrument;
		}
		
		public getBeatsPerMinute(): number {
			return this.tempo;
		}
	}
	
	class GuitarString {
		public delayLine: Float32Array | null = null;
		public delayIndex: number;
		public allPassSample: number;
		public allPassPrevInput: number;
		public shelfSample: number;
		public shelfPrevInput: number;
		public fractionalDelaySample: number;
		public prevDelayLength: number;
		public delayResetOffset: number;
		
		constructor() {
			this.reset();
		}
		
		public reset(): void {
			this.delayIndex = -1;
			this.allPassSample = 0.0;
			this.allPassPrevInput = 0.0;
			this.shelfSample = 0.0;
			this.shelfPrevInput = 0.0;
			this.fractionalDelaySample = 0.0;
			this.prevDelayLength = -1.0;
			this.delayResetOffset = 0;
		}
	}
	
	class Tone {
		public instrumentIndex: number;
		public readonly pitches: number[] = [0, 0, 0, 0];
		public pitchCount: number = 0;
		public chordSize: number = 0;
		public drumsetPitch: number = 0;
		public note: Note | null = null;
		public prevNote: Note | null = null;
		public nextNote: Note | null = null;
		public prevNotePitchIndex: number = 0;
		public nextNotePitchIndex: number = 0;
		public active: boolean = false;
		public isOnLastTick: boolean = false;
		public noteStart: number = 0;
		public noteEnd: number = 0;
		public noteLengthTicks: number = 0;
		public ticksSinceReleased: number = 0;
		public liveInputSamplesHeld: number = 0;
		public lastInterval: number = 0;
		public lastNoteExpression: number = 0;
		public sample: number = 0.0;
		public readonly phases: number[] = [];
		public readonly phaseDeltas: number[] = [];
		public readonly expressionStarts: number[] = [];
		public readonly expressionDeltas: number[] = [];
		public phaseDeltaScale: number = 0.0;
		public pulseWidth: number = 0.0;
		public pulseWidthDelta: number = 0.0;
		public guitarString: GuitarString | null = null;
		
		public readonly filters: DynamicBiquadFilter[] = [];
		public filterCount: number = 0;
		public initialFilterInput1: number = 0.0;
		public initialFilterInput2: number = 0.0;
		
		public vibratoScale: number = 0.0;
		public intervalMult: number = 0.0;
		public intervalExpressionMult: number = 1.0;
		public feedbackOutputs: number[] = [];
		public feedbackMult: number = 0.0;
		public feedbackDelta: number = 0.0;
		
		constructor() {
			this.reset();
		}
		
		public reset(): void {
			this.sample = 0.0;
			for (let i: number = 0; i < Config.operatorCount; i++) {
				this.phases[i] = 0.0;
				this.feedbackOutputs[i] = 0.0;
			}
			for (let i: number = 0; i < this.filterCount; i++) {
				this.filters[i].resetOutput();
			}
			this.filterCount = 0;
			this.initialFilterInput1 = 0.0;
			this.initialFilterInput2 = 0.0;
			this.liveInputSamplesHeld = 0;
			if (this.guitarString != null) this.guitarString.reset();
		}
	}
	
	class InstrumentState {
		public instrument: Instrument;
		
		public awake: boolean = false; // Whether the instrument's effects-processing loop should continue.
		public computed: boolean = false; // Whether the effects-processing parameters are up-to-date for the current synth run.
		public tonesAddedInThisTick: boolean = false; // Whether any instrument tones are currently active.
		public flushingDelayLines: boolean = false; // If no tones were active recently, enter a mode where the delay lines are filled with zeros to reset them for later use.
		public deactivateAfterThisTick: boolean = false; // Whether the instrument is ready to be deactivated because the delay lines, if any, are fully zeroed.
		public attentuationProgress: number = 0.0; // How long since an active tone introduced an input signal to the delay lines, normalized from 0 to 1 based on how long to wait until the delay lines signal will have audibly dissapated.
		public flushedSamples: number = 0; // How many delay line samples have been flushed to zero.
		public readonly releasedTones: Deque<Tone> = new Deque<Tone>(); // Tones that are in the process of fading out after the corresponding notes ended.
		
		public volumeStart: number = 1.0;
		public volumeDelta: number = 0.0;
		public delayInputMultStart: number = 0.0;
		public delayInputMultDelta: number = 0.0;
		
		public bitcrusherCurrentValue: number = 0.0;
		public bitcrusherPhase: number = 1.0;
		public bitcrusherPhaseDelta: number = 0.0;
		public bitcrusherPhaseDeltaScale: number = 1.0;
		public bitcrusherScale: number = 1.0;
		public bitcrusherScaleDelta: number = 0.0;
		
		public readonly distortionFilters: DynamicBiquadFilter[] = [];
		public distortionFilterCount: number = 0;
		public initialDistortionFilterInput1: number = 0.0;
		public initialDistortionFilterInput2: number = 0.0;
		
		public panningDelayLine: Float32Array | null = null;
		public panningDelayPos: number = 0;
		public panningVolumeStartL: number = 0.0;
		public panningVolumeStartR: number = 0.0;
		public panningVolumeDeltaL: number = 0.0;
		public panningVolumeDeltaR: number = 0.0;
		public panningOffsetStartL: number = 0.0;
		public panningOffsetStartR: number = 0.0;
		public panningOffsetDeltaL: number = 0.0;
		public panningOffsetDeltaR: number = 0.0;
		
		public chorusDelayLineL: Float32Array | null = null;
		public chorusDelayLineR: Float32Array | null = null;
		public chorusDelayLineDirty: boolean = false;
		public chorusDelayPos: number = 0;
		public chorusPhase: number = 0;
		
		public reverbDelayLine: Float32Array | null = null;
		public reverbDelayLineDirty: boolean = false;
		public reverbDelayPos: number = 0;
		public reverbFeedback0: number = 0.0;
		public reverbFeedback1: number = 0.0;
		public reverbFeedback2: number = 0.0;
		public reverbFeedback3: number = 0.0;
		public reverbMult: number = 0.0;
		
		public allocateNecessaryBuffers(synth: Synth, instrument: Instrument): void {
			if (effectsIncludePanning(instrument.effects)) {
				if (this.panningDelayLine == null || this.panningDelayLine.length < synth.panningDelayBufferSize) {
					this.panningDelayLine = new Float32Array(synth.panningDelayBufferSize);
				}
			}
			if (effectsIncludeChorus(instrument.effects)) {
				if (this.chorusDelayLineL == null || this.chorusDelayLineL.length < synth.chorusDelayBufferSize) {
					this.chorusDelayLineL = new Float32Array(synth.chorusDelayBufferSize);
				}
				if (this.chorusDelayLineR == null || this.chorusDelayLineR.length < synth.chorusDelayBufferSize) {
					this.chorusDelayLineR = new Float32Array(synth.chorusDelayBufferSize);
				}
			}
			if (effectsIncludeReverb(instrument.effects)) {
				// TODO: Make reverb delay line sample rate agnostic. Maybe just double buffer size for 96KHz? Adjust attenuation and shelf cutoff appropriately?
				if (this.reverbDelayLine == null) {
					this.reverbDelayLine = new Float32Array(Config.reverbDelayBufferSize);
				}
			}
		}
		
		public deactivate(): void {
			this.bitcrusherCurrentValue = 0.0;
			this.bitcrusherPhase = 1.0;
			for (const filter of this.distortionFilters) filter.resetOutput();
			this.distortionFilterCount = 0;
			this.initialDistortionFilterInput1 = 0.0;
			this.initialDistortionFilterInput2 = 0.0;
			this.panningDelayPos = 0;
			if (this.panningDelayLine != null) for (let i: number = 0; i < this.panningDelayLine.length; i++) this.panningDelayLine[i] = 0.0;
			
			this.awake = false;
			this.flushingDelayLines = false;
			this.deactivateAfterThisTick = false;
			this.attentuationProgress = 0.0;
			this.flushedSamples = 0;
		}
		
		public resetAllEffects(): void {
			this.deactivate();
			
			if (this.chorusDelayLineDirty) {
				for (let i: number = 0; i < this.chorusDelayLineL!.length; i++) this.chorusDelayLineL![i] = 0.0;
				for (let i: number = 0; i < this.chorusDelayLineR!.length; i++) this.chorusDelayLineR![i] = 0.0;
			}
			if (this.reverbDelayLineDirty) {
				for (let i: number = 0; i < this.reverbDelayLine!.length; i++) this.reverbDelayLine![i] = 0.0;
			}
			
			this.chorusPhase = 0.0;
			this.reverbFeedback0 = 0.0;
			this.reverbFeedback1 = 0.0;
			this.reverbFeedback2 = 0.0;
			this.reverbFeedback3 = 0.0;
		}
		
		public compute(synth: Synth, instrument: Instrument, samplesPerTick: number, runLength: number): void {
			this.computed = true;
			
			this.allocateNecessaryBuffers(synth, instrument);
			
			const samplesPerSecond: number = synth.samplesPerSecond;
			const tickSampleCountdown: number = synth.tickSampleCountdown;
			
			const usesBitcrusher: boolean = effectsIncludeBitcrusher(instrument.effects);
			const usesPanning: boolean = effectsIncludePanning(instrument.effects);
			const usesChorus: boolean = effectsIncludeChorus(instrument.effects);
			const usesReverb: boolean = effectsIncludeReverb(instrument.effects);
			
			if (usesBitcrusher) {
				const basePitch: number = Config.keys[synth.song!.key].basePitch; // TODO: What if there's a key change mid-song?
				const freq: number = Instrument.frequencyFromPitch(basePitch + 60) * Math.pow(2.0, (Config.bitcrusherFreqRange - 1 - instrument.bitcrusherFreq) * Config.bitcrusherOctaveStep);
				this.bitcrusherPhaseDelta = Math.min(1.0, freq / samplesPerSecond);
				this.bitcrusherScale = 4 * Math.pow(2.0, Math.pow(2.0, (Config.bitcrusherQuantizationRange - 1 - instrument.bitcrusherQuantization) * 0.5));
				// TODO: Automation.
				this.bitcrusherPhaseDeltaScale = 1.0;
				this.bitcrusherScaleDelta = 0.0;
			}
			
			// TODO: Automation.
			let distortionFilterVolume: number = 1.0;
			const distortionFilterSettings: FilterSettings = instrument.distortionFilter;
			for (let i: number = 0; i < distortionFilterSettings.controlPointCount; i++) {
				const point: FilterControlPoint = distortionFilterSettings.controlPoints[i];
				point.toCoefficients(Synth.tempFilterStartCoefficients, samplesPerSecond, 1.0, 1.0, 1.0);
				point.toCoefficients(Synth.tempFilterEndCoefficients, samplesPerSecond, 1.0, 1.0, 1.0);
				if (this.distortionFilters.length <= i) this.distortionFilters[i] = new DynamicBiquadFilter();
				this.distortionFilters[i].loadCoefficientsWithGradient(Synth.tempFilterStartCoefficients, Synth.tempFilterEndCoefficients, 1.0 / runLength);
				distortionFilterVolume *= point.getVolumeCompensationMult();
			}
			this.distortionFilterCount = distortionFilterSettings.controlPointCount;
			distortionFilterVolume = Math.min(3.0, distortionFilterVolume);
			
			const instrumentVolumeMult: number = Synth.instrumentVolumeToVolumeMult(instrument.volume);
			let volumeStart: number = instrumentVolumeMult * distortionFilterVolume;
			let volumeEnd: number = instrumentVolumeMult * distortionFilterVolume;
			let delayInputMultStart: number = 1.0;
			let delayInputMultEnd: number = 1.0;
			
			if (usesPanning) {
				const pan: number = (instrument.pan - Config.panCenter) / Config.panCenter;
				const maxDelaySamples: number = samplesPerSecond * Config.panDelaySecondsMax;
				const delaySamples: number = pan * maxDelaySamples * 2.0;
				this.panningVolumeStartL = Math.cos((1 + pan) * Math.PI * 0.25) * 1.414;
				this.panningVolumeStartR = Math.cos((1 - pan) * Math.PI * 0.25) * 1.414;
				this.panningVolumeDeltaL = 0.0; // TODO: Automation.
				this.panningVolumeDeltaR = 0.0; // TODO: Automation.
				this.panningOffsetStartL = Math.max(0.0, delaySamples);
				this.panningOffsetStartR = Math.max(0.0, -delaySamples);
				this.panningOffsetDeltaL = 0.0; // TODO: Automation.
				this.panningOffsetDeltaR = 0.0; // TODO: Automation.
			}
			
			if (usesReverb) {
				this.reverbMult = Math.pow(instrument.reverb / Config.reverbRange, 0.667) * 0.425;
			}
			
			if (this.tonesAddedInThisTick) {
				this.attentuationProgress = 0.0;
				this.flushedSamples = 0;
				this.flushingDelayLines = false;
			} else if (!this.flushingDelayLines) {
				const tickProgressStart: number = (tickSampleCountdown            ) / samplesPerTick;
				const tickProgressEnd:   number = (tickSampleCountdown - runLength) / samplesPerTick;
				
				// If this instrument isn't playing tones anymore, the volume can fade out by the
				// end of the first tick. It's possible for filters and the panning delay line to
				// continue past the end of the tone but they should have mostly dissipated by the
				// end of the tick anyway.
				if (this.attentuationProgress == 0.0) {
					volumeStart *= tickProgressStart;
					volumeEnd *= tickProgressEnd;
				} else {
					volumeStart = 0.0;
					volumeEnd = 0.0;
				}
				
				const attenuationThreshold: number = 1.0 / 256.0; // when the delay line signal has attenuated this much, it should be inaudible and should be flushed to zero.
				const halfLifeMult: number = -Math.log2(attenuationThreshold);
				let delayDuration: number = 0.0;
				
				if (usesChorus) {
					delayDuration += Config.chorusMaxDelay;
				}
				
				if (usesReverb) {
					const averageMult: number = this.reverbMult * 2.0;
					const averageDelaySeconds: number = (Config.reverbDelayBufferSize / 4.0) / samplesPerSecond;
					const attenuationPerSecond: number = Math.pow(averageMult, 1.0 / averageDelaySeconds);
					const halfLife: number = -1.0 / Math.log2(attenuationPerSecond);
					const reverbDuration: number = halfLife * halfLifeMult;
					delayDuration += reverbDuration;
				}
				
				const secondsInTick: number = samplesPerTick / samplesPerSecond;
				const tickIsEnding: boolean = (runLength >= tickSampleCountdown);
				const progressInTick: number = secondsInTick / delayDuration;
				const progressAtEndOfTick: number = this.attentuationProgress + progressInTick;
				if (progressAtEndOfTick >= 1.0) {
					delayInputMultStart *= tickProgressStart;
					delayInputMultEnd *= tickProgressEnd;
				}
				if (tickIsEnding) {
					this.attentuationProgress = progressAtEndOfTick;
					if (this.attentuationProgress >= 1.0) {
						this.flushingDelayLines = true;
					}
				}
			} else {
				// Flushing delay lines to zero since the signal has mostly dissipated.
				volumeStart = 0.0;
				volumeEnd = 0.0;
				delayInputMultStart = 0.0;
				delayInputMultEnd = 0.0;
				
				let totalDelaySamples: number = 0;
				if (usesChorus) totalDelaySamples += synth.chorusDelayBufferSize;
				if (usesReverb) totalDelaySamples += Config.reverbDelayBufferSize;
				
				this.flushedSamples += runLength;
				if (this.flushedSamples >= totalDelaySamples) {
					this.deactivateAfterThisTick = true;
				}
			}
			
			this.volumeStart = volumeStart;
			this.volumeDelta = (volumeEnd - volumeStart) / runLength;
			this.delayInputMultStart = delayInputMultStart;
			this.delayInputMultDelta = (delayInputMultEnd - delayInputMultStart) / runLength;
		}
	}
	
	class ChannelState {
		public readonly instruments: InstrumentState[] = [];
		public readonly activeTones: Deque<Tone> = new Deque<Tone>();
	}
	
	export class Synth {
	
		private syncSongState(): void {
			const channelCount: number = this.song!.getChannelCount();
			for (let i: number = this.channels.length; i < channelCount; i++) {
				this.channels[i] = new ChannelState();
			}
			this.channels.length = channelCount;
			for (let i: number = 0; i < channelCount; i++) {
				const channelState: ChannelState = this.channels[i];
				for (let j: number = channelState.instruments.length; j < this.song!.instrumentsPerChannel; j++) {
					channelState.instruments[j] = new InstrumentState();
				}
				channelState.instruments.length = this.song!.instrumentsPerChannel;
			}
		}
		
		private warmUpSynthesizer(song: Song | null): void {
			// Don't bother to generate the drum waves unless the song actually
			// uses them, since they may require a lot of computation.
			if (song != null) {
				this.syncSongState();
				for (let j: number = 0; j < song.getChannelCount(); j++) {
					for (let i: number = 0; i < song.instrumentsPerChannel; i++) {
						const instrument: Instrument = song.channels[j].instruments[i];
						const instrumentState: InstrumentState = this.channels[j].instruments[i];
						Synth.getInstrumentSynthFunction(instrument);
						instrument.warmUp(this.samplesPerSecond);
						instrumentState.allocateNecessaryBuffers(this, instrument);
					}
				}
			}
		}
		
		private static operatorAmplitudeCurve(amplitude: number): number {
			return (Math.pow(16.0, amplitude / 15.0) - 1.0) / 15.0;
		}
		
		public samplesPerSecond: number = 44100;
		public guitarDelayBufferSize: number;
		public guitarDelayBufferMask: number;
		public panningDelayBufferSize: number;
		public panningDelayBufferMask: number;
		public chorusDelayBufferSize: number;
		public chorusDelayBufferMask: number;
		// TODO: reverb
		
		public song: Song | null = null;
		public liveInputDuration: number = 0;
		public liveInputStarted: boolean = false;
		public liveInputPitches: number[] = [];
		public liveInputChannel: number = 0;
		public loopRepeatCount: number = -1;
		public volume: number = 1.0;
		
		private playheadInternal: number = 0.0;
		private bar: number = 0;
		private beat: number = 0;
		private part: number = 0;
		private tick: number = 0;
		public tickSampleCountdown: number = 0;
		private isPlayingSong: boolean = false;
		private liveInputEndTime: number = 0.0;
		
		public static readonly tempFilterStartCoefficients: FilterCoefficients = new FilterCoefficients();
		public static readonly tempFilterEndCoefficients: FilterCoefficients = new FilterCoefficients();
		private tempDrumSetControlPoint: FilterControlPoint = new FilterControlPoint();
		private tempFrequencyResponse: FrequencyResponse = new FrequencyResponse();
		
		private static readonly fmSynthFunctionCache: Dictionary<Function> = {};
		private static readonly effectsFunctionCache: Function[] = Array(1 << 5).fill(undefined); // keep in sync with the number of post-process effects.
		
		private readonly channels: ChannelState[] = [];
		private readonly tonePool: Deque<Tone> = new Deque<Tone>();
		private readonly liveInputTones: Deque<Tone> = new Deque<Tone>();
		
		private limit: number = 0.0;
		
		private tempMonoInstrumentSampleBuffer: Float32Array | null = null;
		
		private audioCtx: any | null = null;
		private scriptNode: any | null = null;
		
		public get playing(): boolean {
			return this.isPlayingSong;
		}
		
		public get playhead(): number {
			return this.playheadInternal;
		}
		
		public set playhead(value: number) {
			if (this.song != null) {
				this.playheadInternal = Math.max(0, Math.min(this.song.barCount, value));
				let remainder: number = this.playheadInternal;
				this.bar = Math.floor(remainder);
				remainder = this.song.beatsPerBar * (remainder - this.bar);
				this.beat = Math.floor(remainder);
				remainder = Config.partsPerBeat * (remainder - this.beat);
				this.part = Math.floor(remainder);
				remainder = Config.ticksPerPart * (remainder - this.part);
				this.tick = Math.floor(remainder);
				const samplesPerTick: number = this.getSamplesPerTick();
				remainder = samplesPerTick * (remainder - this.tick);
				this.tickSampleCountdown = samplesPerTick - remainder;
			}
		}
		
		public getSamplesPerBar(): number {
			if (this.song == null) throw new Error();
			return this.getSamplesPerTick() * Config.ticksPerPart * Config.partsPerBeat * this.song.beatsPerBar;
		}
		
		public getTotalBars(enableIntro: boolean, enableOutro: boolean): number {
			if (this.song == null) throw new Error();
			let bars: number = this.song.loopLength * (this.loopRepeatCount + 1);
			if (enableIntro) bars += this.song.loopStart;
			if (enableOutro) bars += this.song.barCount - (this.song.loopStart + this.song.loopLength);
			return bars;
		}
		
		constructor(song: Song | string | null = null) {
			this.computeDelayBufferSizes();
			if (song != null) this.setSong(song);
		}
		
		public setSong(song: Song | string): void {
			if (typeof(song) == "string") {
				this.song = new Song(song);
			} else if (song instanceof Song) {
				this.song = song;
			}
		}
		
		private computeDelayBufferSizes(): void {
			this.guitarDelayBufferSize = Synth.fittingPowerOfTwo(this.samplesPerSecond / Instrument.frequencyFromPitch(12));
			this.guitarDelayBufferMask = this.guitarDelayBufferSize - 1;
			this.panningDelayBufferSize = Synth.fittingPowerOfTwo(this.samplesPerSecond * Config.panDelaySecondsMax);
			this.panningDelayBufferMask = this.panningDelayBufferSize - 1;
			this.chorusDelayBufferSize = Synth.fittingPowerOfTwo(this.samplesPerSecond * Config.chorusMaxDelay);
			this.chorusDelayBufferMask = this.chorusDelayBufferSize - 1;
		}
		
		private activateAudio(): void {
			if (this.audioCtx == null || this.scriptNode == null) {
				this.audioCtx = this.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
				this.samplesPerSecond = this.audioCtx.sampleRate;
				this.scriptNode = this.audioCtx.createScriptProcessor ? this.audioCtx.createScriptProcessor(2048, 0, 2) : this.audioCtx.createJavaScriptNode(2048, 0, 2); // 2048, 0 input channels, 2 output channels
				this.scriptNode.onaudioprocess = this.audioProcessCallback;
				this.scriptNode.channelCountMode = 'explicit';
				this.scriptNode.channelInterpretation = 'speakers';
				this.scriptNode.connect(this.audioCtx.destination);
				
				this.computeDelayBufferSizes();
			}
			this.audioCtx.resume();
		}
		
		private deactivateAudio(): void {
			if (this.audioCtx != null && this.scriptNode != null) {
				this.scriptNode.disconnect(this.audioCtx.destination);
				this.scriptNode = null;
				if (this.audioCtx.close) this.audioCtx.close(); // firefox is missing this function?
				this.audioCtx = null;
			}
		}
		
		public maintainLiveInput(): void {
			this.activateAudio();
			this.liveInputEndTime = performance.now() + 10000.0;
		}
		
		public play(): void {
			if (this.isPlayingSong) return;
			this.isPlayingSong = true;
			this.activateAudio();
			this.warmUpSynthesizer(this.song);
		}
		
		public pause(): void {
			if (!this.isPlayingSong) return;
			this.isPlayingSong = false;
		}
		
		public snapToStart(): void {
			this.bar = 0;
			this.snapToBar();
		}
		
		public goToBar(bar: number): void {
			this.bar = bar;
			this.playheadInternal = this.bar;
		}
		
		public snapToBar(): void {
			this.playheadInternal = this.bar;
			this.beat = 0;
			this.part = 0;
			this.tick = 0;
			this.tickSampleCountdown = 0;
		}
		
		public resetEffects(): void {
			this.limit = 0.0;
			this.freeAllTones();
			if (this.song != null) {
				for (const channelState of this.channels) {
					for (const instrumentState of channelState.instruments) {
						instrumentState.resetAllEffects();
					}
				}
			}
		}
		
		public jumpIntoLoop(): void {
			if (!this.song) return;
			if (this.bar < this.song.loopStart || this.bar >= this.song.loopStart + this.song.loopLength) {
				const oldBar: number = this.bar;
				this.bar = this.song.loopStart;
				this.playheadInternal += this.bar - oldBar;
			}
		}
		
		public nextBar(): void {
			if (!this.song) return;
			const oldBar: number = this.bar;
			this.bar++;
			if (this.bar >= this.song.barCount) {
				this.bar = 0;
			}
			this.playheadInternal += this.bar - oldBar;
		}
		
		public prevBar(): void {
			if (!this.song) return;
			const oldBar: number = this.bar;
			this.bar--;
			if (this.bar < 0 || this.bar >= this.song.barCount) {
				this.bar = this.song.barCount - 1;
			}
			this.playheadInternal += this.bar - oldBar;
		}
		
		private audioProcessCallback = (audioProcessingEvent: any): void => {
			const outputBuffer = audioProcessingEvent.outputBuffer;
			const outputDataL: Float32Array = outputBuffer.getChannelData(0);
			const outputDataR: Float32Array = outputBuffer.getChannelData(1);
			
			const isPlayingLiveTones = performance.now() < this.liveInputEndTime;
			if (!isPlayingLiveTones && !this.isPlayingSong) {
				for (let i: number = 0; i < outputBuffer.length; i++) {
					outputDataL[i] = 0.0;
					outputDataR[i] = 0.0;
				}
				this.deactivateAudio();
			} else {
				this.synthesize(outputDataL, outputDataR, outputBuffer.length, this.isPlayingSong);
			}
		}
		
		public synthesize(outputDataL: Float32Array, outputDataR: Float32Array, outputBufferLength: number, playSong: boolean = true): void {
			if (this.song == null) {
				for (let i: number = 0; i < outputBufferLength; i++) {
					outputDataL[i] = 0.0;
					outputDataR[i] = 0.0;
				}
				this.deactivateAudio();
				return;
			}
			
			const song: Song = this.song;
			const samplesPerTick: number = this.getSamplesPerTick();
			let ended: boolean = false;
			
			// Check the bounds of the playhead:
			while (this.tickSampleCountdown <= 0) this.tickSampleCountdown += samplesPerTick;
			if (this.tickSampleCountdown > samplesPerTick) this.tickSampleCountdown = samplesPerTick;
			if (playSong) {
				if (this.beat >= song.beatsPerBar) {
					this.bar++;
					this.beat = 0;
					this.part = 0;
					this.tick = 0;
					this.tickSampleCountdown = samplesPerTick;
				
					if (this.loopRepeatCount != 0 && this.bar == song.loopStart + song.loopLength) {
						this.bar = song.loopStart;
						if (this.loopRepeatCount > 0) this.loopRepeatCount--;
					}
				}
				if (this.bar >= song.barCount) {
					this.bar = 0;
					if (this.loopRepeatCount != -1) {
						ended = true;
						this.pause();
					}
				}
			}
			
			//const synthStartTime: number = performance.now();
			
			this.syncSongState();
			
			if (this.tempMonoInstrumentSampleBuffer == null || this.tempMonoInstrumentSampleBuffer.length < outputBufferLength) {
				this.tempMonoInstrumentSampleBuffer = new Float32Array(outputBufferLength);
			}
			
			// Post processing parameters:
			const volume: number = +this.volume;
			const limitDecay: number = 1.0 - Math.pow(0.5, 4.0 / this.samplesPerSecond);
			const limitRise: number = 1.0 - Math.pow(0.5, 4000.0 / this.samplesPerSecond);
			let limit: number = +this.limit;
			
			let bufferIndex: number = 0;
			while (bufferIndex < outputBufferLength && !ended) {
				
				const samplesLeftInBuffer: number = outputBufferLength - bufferIndex;
				const samplesLeftInTick: number = Math.ceil(this.tickSampleCountdown);
				const runLength: number = Math.min(samplesLeftInTick, samplesLeftInBuffer);
				for (let channelIndex: number = 0; channelIndex < song.getChannelCount(); channelIndex++) {
					const channel: Channel = song.channels[channelIndex];
					const channelState: ChannelState = this.channels[channelIndex];
					const currentPatternInstrumentIndex: number = song.getPatternInstrument(channelIndex, this.bar);
					let tonesPlayedInThisChannel: number = 0;
					
					for (let instrumentIndex: number = 0; instrumentIndex < song.instrumentsPerChannel; instrumentIndex++) {
						const instrument: Instrument = channel.instruments[instrumentIndex];
						const instrumentState: InstrumentState = channelState.instruments[instrumentIndex];
						
						if (instrumentIndex == currentPatternInstrumentIndex) {
							if (channelIndex == this.liveInputChannel) {
								this.determineLiveInputTones(song);
								
								for (let i: number = 0; i < this.liveInputTones.count(); i++) {
									const tone: Tone = this.liveInputTones.get(i);
									this.playTone(song, channelIndex, samplesPerTick, bufferIndex, runLength, tone, false, false);
									tonesPlayedInThisChannel++;
								}
							}
							
							this.determineCurrentActiveTones(song, channelIndex, playSong);
							for (let i: number = 0; i < channelState.activeTones.count(); i++) {
								const tone: Tone = channelState.activeTones.get(i);
								this.playTone(song, channelIndex, samplesPerTick, bufferIndex, runLength, tone, false, false);
								tonesPlayedInThisChannel++;
							}
						}
						
						for (let i: number = 0; i < instrumentState.releasedTones.count(); i++) {
							const tone: Tone = instrumentState.releasedTones.get(i);
							
							if (tone.instrumentIndex >= song.instrumentsPerChannel || tone.ticksSinceReleased >= instrument.getTransition().releaseTicks) {
								this.freeReleasedTone(instrumentState, i);
								i--;
								continue;
							}
							
							const shouldFadeOutFast: boolean = (tonesPlayedInThisChannel >= Config.maximumTonesPerChannel);
							this.playTone(song, channelIndex, samplesPerTick, bufferIndex, runLength, tone, true, shouldFadeOutFast);
							tonesPlayedInThisChannel++;
						}
						
						if (instrumentState.awake) {
							if (!instrumentState.computed) {
								instrumentState.compute(this, instrument, samplesPerTick, runLength);
							}
							
							Synth.effectsSynth(this, outputDataL, outputDataR, bufferIndex, runLength, instrument, instrumentState);
							
							instrumentState.computed = false;
						}
					}
				}
				
				// Post processing:
				const runEnd: number = bufferIndex + runLength;
				for (let i: number = bufferIndex; i < runEnd; i++) {
					// A compressor/limiter.
					const sampleL = outputDataL[i];
					const sampleR = outputDataR[i];
					const abs: number = Math.max(Math.abs(sampleL), Math.abs(sampleR));
					limit += (abs - limit) * (limit < abs ? limitRise : limitDecay * (1.0 + limit));
					const limitedVolume = volume / (limit >= 1 ? limit * 1.05 : limit * 0.8 + 0.25);
					outputDataL[i] = sampleL * limitedVolume;
					outputDataR[i] = sampleR * limitedVolume;
				}
				
				bufferIndex += runLength;
				
				this.tickSampleCountdown -= runLength;
				if (this.tickSampleCountdown <= 0) {
					
					// Track how long tones have been released, and free ones that are marked as ending.
					// Also reset awake InstrumentStates that didn't have any Tones during this tick.
					for (let channelIndex: number = 0; channelIndex < song.getChannelCount(); channelIndex++) {
						const channelState: ChannelState = this.channels[channelIndex];
						for (let instrumentIndex: number = 0; instrumentIndex < song.instrumentsPerChannel; instrumentIndex++) {
							const instrumentState: InstrumentState = channelState.instruments[instrumentIndex];
							for (let i: number = 0; i < instrumentState.releasedTones.count(); i++) {
								const tone: Tone = instrumentState.releasedTones.get(i);
								if (tone.isOnLastTick) {
									this.freeReleasedTone(instrumentState, i);
									i--;
								} else {
									tone.ticksSinceReleased++;
								}
							}
							if (instrumentState.deactivateAfterThisTick) {
								instrumentState.deactivate();
							}
							instrumentState.tonesAddedInThisTick = false;
						}
					}
					
					this.tick++;
					this.tickSampleCountdown += samplesPerTick;
					if (this.tick == Config.ticksPerPart) {
						this.tick = 0;
						this.part++;
						this.liveInputDuration--;
						
						// Check if any active tones should be released.
						for (let channelIndex: number = 0; channelIndex < song.getChannelCount(); channelIndex++) {
							const channel: Channel = song.channels[channelIndex];
							const channelState: ChannelState = this.channels[channelIndex];
							for (let i: number = 0; i < channelState.activeTones.count(); i++) {
								const tone: Tone = channelState.activeTones.get(i);
								const instrument: Instrument = channel.instruments[tone.instrumentIndex];
								const transition: Transition = instrument.getTransition();
								if (!transition.isSeamless && tone.note != null && tone.note.end == this.part + this.beat * Config.partsPerBeat) {
									if (transition.releases) {
										this.releaseTone(channelState.instruments[tone.instrumentIndex], tone);
									} else {
										this.freeTone(tone);
									}
									channelState.activeTones.remove(i);
									i--;
								}
							}
						}
						
						if (this.part == Config.partsPerBeat) {
							this.part = 0;
							
							if (playSong) {
								this.beat++;
								if (this.beat == song.beatsPerBar) {
									// bar changed, reset for next bar:
									this.beat = 0;
									this.bar++;
									if (this.loopRepeatCount != 0 && this.bar == song.loopStart + song.loopLength) {
										this.bar = song.loopStart;
										if (this.loopRepeatCount > 0) this.loopRepeatCount--;
									}
									if (this.bar >= song.barCount) {
										this.bar = 0;
										if (this.loopRepeatCount != -1) {
											ended = true;
											this.resetEffects();
											this.pause();
										}
									}
								}
							}
						}
					}
				}
			}
			
			// Avoid persistent denormal or NaN values.
			if (!Number.isFinite(limit) || Math.abs(limit) < epsilon) limit = 0.0;
			this.limit = limit;
			
			if (playSong) {
				this.playheadInternal = (((this.tick + 1.0 - this.tickSampleCountdown / samplesPerTick) / 2.0 + this.part) / Config.partsPerBeat + this.beat) / song.beatsPerBar + this.bar;
			}
			
			/*
			const synthDuration: number = performance.now() - synthStartTime;
			// Performance measurements:
			samplesAccumulated += outputBufferLength;
			samplePerformance += synthDuration;
			
			if (samplesAccumulated >= 44100 * 4) {
				const secondsGenerated = samplesAccumulated / 44100;
				const secondsRequired = samplePerformance / 1000;
				const ratio = secondsRequired / secondsGenerated;
				console.log(ratio);
				samplePerformance = 0;
				samplesAccumulated = 0;
			}
			*/
		}
		
		private freeTone(tone: Tone): void {
			this.tonePool.pushBack(tone);
		}
		
		private newTone(): Tone {
			if (this.tonePool.count() > 0) {
				const tone: Tone = this.tonePool.popBack();
				tone.reset();
				tone.active = false;
				return tone;
			}
			return new Tone();
		}
		
		private releaseTone(instrumentState: InstrumentState, tone: Tone): void {
			instrumentState.releasedTones.pushFront(tone);
		}
		
		private freeReleasedTone(instrumentState: InstrumentState, toneIndex: number): void {
			this.freeTone(instrumentState.releasedTones.get(toneIndex));
			instrumentState.releasedTones.remove(toneIndex);
		}
		
		public freeAllTones(): void {
			while (this.liveInputTones.count() > 0) {
				this.freeTone(this.liveInputTones.popBack());
			}
			for (const channelState of this.channels) {
				while (channelState.activeTones.count() > 0) {
					this.freeTone(channelState.activeTones.popBack());
				}
				for (const instrumentState of channelState.instruments) {
					while (instrumentState.releasedTones.count() > 0) {
						this.freeTone(instrumentState.releasedTones.popBack());
					}
				}
			}
		}
		
		private determineLiveInputTones(song: Song): void {
			const toneList: Deque<Tone> = this.liveInputTones;
			const pitches: number[] = this.liveInputPitches;
			let toneCount: number = 0;
			const instrumentIndex: number = song.getPatternInstrument(this.liveInputChannel, this.bar);
			const instrumentState: InstrumentState = this.channels[this.liveInputChannel].instruments[instrumentIndex];
			if (this.liveInputDuration > 0) {
				const instrument: Instrument = song.channels[this.liveInputChannel].instruments[instrumentIndex];
				
				if (instrument.getChord().arpeggiates) {
					let tone: Tone;
					if (toneList.count() == 0) {
						tone = this.newTone();
						toneList.pushBack(tone);
					} else if (!instrument.getTransition().isSeamless && this.liveInputStarted) {
						this.releaseTone(instrumentState, toneList.popFront());
						tone = this.newTone();
						toneList.pushBack(tone);
					} else {
						tone = toneList.get(0);
					}
					toneCount = 1;
				
					for (let i: number = 0; i < pitches.length; i++) {
						tone.pitches[i] = pitches[i];
					}
					tone.pitchCount = pitches.length;
					tone.chordSize = 1;
					tone.instrumentIndex = instrumentIndex;
					tone.note = tone.prevNote = tone.nextNote = null;
				} else {
					//const transition: Transition = instrument.getTransition();
					for (let i: number = 0; i < pitches.length; i++) {
						//const strumOffsetParts: number = i * instrument.getChord().strumParts;

						let tone: Tone;
						if (toneList.count() <= i) {
							tone = this.newTone();
							toneList.pushBack(tone);
						} else if (!instrument.getTransition().isSeamless && this.liveInputStarted) {
							this.releaseTone(instrumentState, toneList.get(i));
							tone = this.newTone();
							toneList.set(i, tone);
						} else {
							tone = toneList.get(i);
						}
						toneCount++;

						tone.pitches[0] = pitches[i];
						tone.pitchCount = 1;
						tone.chordSize = pitches.length;
						tone.instrumentIndex = instrumentIndex;
						tone.note = tone.prevNote = tone.nextNote = null;
					}
				}
			}
			
			while (toneList.count() > toneCount) {
				this.releaseTone(instrumentState, toneList.popBack());
			}
			
			this.liveInputStarted = false;
		}
		
		private determineCurrentActiveTones(song: Song, channelIndex: number, playSong: boolean): void {
			const channel: Channel = song.channels[channelIndex];
			const instrumentIndex: number = song.getPatternInstrument(channelIndex, this.bar);
			const pattern: Pattern | null = song.getPattern(channelIndex, this.bar);
			const time: number = this.part + this.beat * Config.partsPerBeat;
			let note: Note | null = null;
			let prevNote: Note | null = null;
			let nextNote: Note | null = null;
			
			if (playSong && pattern != null && !channel.muted && instrumentIndex < song.instrumentsPerChannel) {
				for (let i: number = 0; i < pattern.notes.length; i++) {
					if (pattern.notes[i].end <= time) {
						prevNote = pattern.notes[i];
					} else if (pattern.notes[i].start <= time && pattern.notes[i].end > time) {
						note = pattern.notes[i];
					} else if (pattern.notes[i].start > time) {
						nextNote = pattern.notes[i];
						break;
					}
				}
			}
			
			const toneList: Deque<Tone> = this.channels[channelIndex].activeTones;
			if (note != null) {
				if (prevNote != null && prevNote.end != note.start) prevNote = null;
				if (nextNote != null && nextNote.start != note.end) nextNote = null;
				this.syncTones(channelIndex, instrumentIndex, toneList, song, note.pitches, note, prevNote, nextNote, time);
			} else {
				this.releaseOrFreeUnusedTones(toneList, 0, song, channelIndex);
			}
		}
		
		private syncTones(channelIndex: number, instrumentIndex: number, toneList: Deque<Tone>, song: Song, pitches: number[], note: Note, prevNote: Note | null, nextNote: Note | null, currentPart: number): void {
			const channel: Channel = song.channels[channelIndex];
			const instrument: Instrument = channel.instruments[instrumentIndex];
			let toneCount: number = 0;
			const chord: Chord = instrument.getChord();
			if (chord.singleTone) {
				let tone: Tone;
				if (toneList.count() == 0) {
					tone = this.newTone();
					toneList.pushBack(tone);
				} else {
					tone = toneList.get(0);
				}
				toneCount = 1;

				for (let i: number = 0; i < pitches.length; i++) {
					tone.pitches[i] = pitches[i];
				}
				tone.pitchCount = pitches.length;
				tone.chordSize = 1;
				tone.instrumentIndex = instrumentIndex;
				tone.note = note;
				tone.noteStart = note.start;
				tone.noteEnd = note.end;
				tone.prevNote = prevNote;
				tone.nextNote = nextNote;
				tone.prevNotePitchIndex = 0;
				tone.nextNotePitchIndex = 0;
			} else {
				const transition: Transition = instrument.getTransition();
				for (let i: number = 0; i < pitches.length; i++) {

					const strumOffsetParts: number = i * instrument.getChord().strumParts;
					let prevNoteForThisTone: Note | null = (prevNote && prevNote.pitches.length > i) ? prevNote : null;
					let noteForThisTone: Note = note;
					let nextNoteForThisTone: Note | null = (nextNote && nextNote.pitches.length > i) ? nextNote : null;
					let noteStart: number = noteForThisTone.start + strumOffsetParts;

					if (noteStart > currentPart) {
						if (toneList.count() > i && transition.isSeamless && prevNoteForThisTone != null) {
							nextNoteForThisTone = noteForThisTone;
							noteForThisTone = prevNoteForThisTone;
							prevNoteForThisTone = null;
							noteStart = noteForThisTone.start + strumOffsetParts;
						} else {
							break;
						}
					}

					let noteEnd: number = noteForThisTone.end;
					if (transition.isSeamless && nextNoteForThisTone != null) {
						noteEnd = Math.min(Config.partsPerBeat * this.song!.beatsPerBar, noteEnd + strumOffsetParts);
					}

					let tone: Tone;
					if (toneList.count() <= i) {
						tone = this.newTone();
						toneList.pushBack(tone);
					} else {
						tone = toneList.get(i);
					}
					toneCount++;

					tone.pitches[0] = noteForThisTone.pitches[i];
					tone.pitchCount = 1;
					tone.chordSize = noteForThisTone.pitches.length;
					tone.instrumentIndex = instrumentIndex;
					tone.note = noteForThisTone;
					tone.noteStart = noteStart;
					tone.noteEnd = noteEnd;
					tone.prevNote = prevNoteForThisTone;
					tone.nextNote = nextNoteForThisTone;
					tone.prevNotePitchIndex = i;
					tone.nextNotePitchIndex = i;
				}
			}
			this.releaseOrFreeUnusedTones(toneList, toneCount, song, channelIndex);
		}
		
		private releaseOrFreeUnusedTones(toneList: Deque<Tone>, maxCount: number, song: Song, channelIndex: number): void {
			while (toneList.count() > maxCount) {
				// Automatically free or release seamless tones if there's no new note to take over.
				const tone: Tone = toneList.popBack();
				const instrument: Instrument = song.channels[channelIndex].instruments[tone.instrumentIndex];
				const instrumentState: InstrumentState = this.channels[channelIndex].instruments[tone.instrumentIndex];
				if (tone.instrumentIndex < song.instrumentsPerChannel && instrument.getTransition().releases) {
					this.releaseTone(instrumentState, tone);
				} else {
					this.freeTone(tone);
				}
			}
		}
		
		private playTone(song: Song, channelIndex: number, samplesPerTick: number, bufferIndex: number, runLength: number, tone: Tone, released: boolean, shouldFadeOutFast: boolean): void {
			const channel: Channel = song.channels[channelIndex];
			const channelState: ChannelState = this.channels[channelIndex];
			const instrument: Instrument = channel.instruments[tone.instrumentIndex];
			const instrumentState: InstrumentState = channelState.instruments[tone.instrumentIndex];
			
			instrumentState.awake = true;
			instrumentState.tonesAddedInThisTick = true;
			if (!instrumentState.computed) {
				instrumentState.compute(this, instrument, samplesPerTick, runLength);
			}
			
			Synth.computeTone(this, song, channelIndex, samplesPerTick, runLength, tone, released, shouldFadeOutFast);
			const synthesizer: Function = Synth.getInstrumentSynthFunction(instrument);
			synthesizer(this, bufferIndex, runLength, tone, instrument);
		}
		
		private static computeEnvelope(envelope: Envelope, time: number, beats: number, noteExpression: number): number {
			switch(envelope.type) {
				case EnvelopeType.custom: return noteExpression;
				case EnvelopeType.steady: return 1.0;
				case EnvelopeType.twang:
					return 1.0 / (1.0 + time * envelope.speed);
				case EnvelopeType.swell:
					return 1.0 - 1.0 / (1.0 + time * envelope.speed);
				case EnvelopeType.tremolo: 
					return 0.5 - Math.cos(beats * 2.0 * Math.PI * envelope.speed) * 0.5;
				case EnvelopeType.tremolo2: 
					return 0.75 - Math.cos(beats * 2.0 * Math.PI * envelope.speed) * 0.25;
				case EnvelopeType.punch: 
					return Math.max(1.0, 2.0 - time * 10.0);
				case EnvelopeType.flare:
					const speed: number = envelope.speed;
					const attack: number = 0.25 / Math.sqrt(speed);
					return time < attack ? time / attack : 1.0 / (1.0 + (time - attack) * speed);
				case EnvelopeType.decay:
					return Math.pow(2, -envelope.speed * time);
				default: throw new Error("Unrecognized operator envelope type.");
			}
		}
		
		private static computeChordExpression(chordSize: number): number {
			return 1.0 / ((chordSize - 1) * 0.25 + 1.0);
		}
		
		private static computeTone(synth: Synth, song: Song, channelIndex: number, samplesPerTick: number, runLength: number, tone: Tone, released: boolean, shouldFadeOutFast: boolean): void {
			const channel: Channel = song.channels[channelIndex];
			const instrument: Instrument = channel.instruments[tone.instrumentIndex];
			const transition: Transition = instrument.getTransition();
			const chord: Chord = instrument.getChord();
			const chordExpression: number = chord.arpeggiates ? 1.0 : Synth.computeChordExpression(tone.chordSize);
			const isNoiseChannel: boolean = song.getChannelIsNoise(channelIndex);
			const intervalScale: number = isNoiseChannel ? Config.noiseInterval : 1;
			const secondsPerPart: number = Config.ticksPerPart * samplesPerTick / synth.samplesPerSecond;
			const beatsPerPart: number = 1.0 / Config.partsPerBeat;
			const toneWasActive: boolean = tone.active;
			const tickSampleCountdown: number = synth.tickSampleCountdown;
			const startRatio: number = 1.0 - (tickSampleCountdown            ) / samplesPerTick;
			const endRatio:   number = 1.0 - (tickSampleCountdown - runLength) / samplesPerTick;
			const ticksIntoBar: number = (synth.beat * Config.partsPerBeat + synth.part) * Config.ticksPerPart + synth.tick;
			const partTimeTickStart: number = (ticksIntoBar    ) / Config.ticksPerPart;
			const partTimeTickEnd:   number = (ticksIntoBar + 1) / Config.ticksPerPart;
			const partTimeStart: number = partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * startRatio;
			const partTimeEnd: number   = partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * endRatio;
			const partsPerBar: number = Config.partsPerBeat * song.beatsPerBar;
			
			tone.phaseDeltaScale = 0.0;
			tone.vibratoScale = 0.0;
			tone.intervalMult = 1.0;
			tone.intervalExpressionMult = 1.0;
			tone.active = false;
			
			let resetPhases: boolean = true;
			let toneIsOnLastTick: boolean = shouldFadeOutFast;
			let intervalStart: number = 0.0;
			let intervalEnd: number = 0.0;
			let transitionExpressionStart: number = 1.0;
			let transitionExpressionEnd: number = 1.0;
			let chordExpressionStart: number = chordExpression;
			let chordExpressionEnd:   number = chordExpression;
			let noteExpressionStart: number = 0.0;
			let noteExpressionEnd: number = 0.0;
			let decayTimeStart: number = 0.0;
			let decayTimeEnd:   number = 0.0;
			
			let expressionReferencePitch: number = 16; // A low "E" as a MIDI pitch.
			let basePitch: number = Config.keys[song.key].basePitch;
			let baseExpression: number = 1.0;
			let pitchDamping: number = 48;
			if (instrument.type == InstrumentType.spectrum) {
				baseExpression = Config.spectrumBaseExpression;
				if (isNoiseChannel) {
					basePitch = Config.spectrumBasePitch;
					baseExpression *= 2.0; // Note: spectrum is louder for drum channels than pitch channels!
				}
				expressionReferencePitch = Config.spectrumBasePitch;
				pitchDamping = 28;
			} else if (instrument.type == InstrumentType.drumset) {
				basePitch = Config.spectrumBasePitch;
				baseExpression = Config.drumsetBaseExpression;
				expressionReferencePitch = basePitch;
			} else if (instrument.type == InstrumentType.noise) {
				basePitch = Config.chipNoises[instrument.chipNoise].basePitch;
				baseExpression = Config.noiseBaseExpression;
				expressionReferencePitch = basePitch;
				pitchDamping = Config.chipNoises[instrument.chipNoise].isSoft ? 24.0 : 60.0;
			} else if (instrument.type == InstrumentType.fm) {
				baseExpression = Config.fmBaseExpression;
			} else if (instrument.type == InstrumentType.chip) {
				baseExpression = Config.chipBaseExpression;
			} else if (instrument.type == InstrumentType.harmonics) {
				baseExpression = Config.harmonicsBaseExpression;
			} else if (instrument.type == InstrumentType.pwm) {
				baseExpression = Config.pwmBaseExpression;
			} else if (instrument.type == InstrumentType.guitar) {
				baseExpression = Config.guitarBaseExpression;
			} else {
				throw new Error("Unknown instrument type in computeTone.");
			}
			
			for (let i: number = 0; i < Config.operatorCount; i++) {
				tone.phaseDeltas[i] = 0.0;
				tone.expressionStarts[i] = 0.0;
				tone.expressionDeltas[i] = 0.0;
			}

			if (released) {
				const startTicksSinceReleased: number = tone.ticksSinceReleased + startRatio;
				const endTicksSinceReleased:   number = tone.ticksSinceReleased + endRatio;
				const startTick: number = tone.noteLengthTicks + startTicksSinceReleased;
				const endTick:   number = tone.noteLengthTicks + endTicksSinceReleased;
				const toneTransition: Transition = instrument.getTransition();
				resetPhases = false;
				intervalStart = intervalEnd = tone.lastInterval;
				noteExpressionStart = noteExpressionEnd = Synth.expressionToVolumeMult(tone.lastNoteExpression);
				transitionExpressionStart = Synth.expressionToVolumeMult((1.0 - startTicksSinceReleased / toneTransition.releaseTicks) * 3.0);
				transitionExpressionEnd   = Synth.expressionToVolumeMult((1.0 - endTicksSinceReleased / toneTransition.releaseTicks) * 3.0);
				decayTimeStart = startTick / Config.ticksPerPart;
				decayTimeEnd   = endTick / Config.ticksPerPart;

				if (shouldFadeOutFast) {
					transitionExpressionStart *= 1.0 - startRatio;
					transitionExpressionEnd *= 1.0 - endRatio;
				}
				
				if (tone.ticksSinceReleased + 1 >= toneTransition.releaseTicks) toneIsOnLastTick = true;
			} else if (tone.note == null) {
				transitionExpressionStart = transitionExpressionEnd = 1;
				noteExpressionStart = noteExpressionEnd = 1;
				tone.lastInterval = 0;
				tone.lastNoteExpression = 3;
				tone.ticksSinceReleased = 0;
				resetPhases = false;
				
				const heldTicksStart: number = tone.liveInputSamplesHeld / samplesPerTick;
				tone.liveInputSamplesHeld += runLength;
				const heldTicksEnd: number = tone.liveInputSamplesHeld / samplesPerTick;
				tone.noteLengthTicks = heldTicksEnd;
				const heldPartsStart: number = heldTicksStart / Config.ticksPerPart;
				const heldPartsEnd: number = heldTicksEnd / Config.ticksPerPart;
				
				decayTimeStart = heldPartsStart;
				decayTimeEnd   = heldPartsEnd;
			} else {
				const note: Note = tone.note;
				const prevNote: Note | null = tone.prevNote;
				const nextNote: Note | null = tone.nextNote;

				const time: number = synth.part + synth.beat * Config.partsPerBeat;
				const noteStart: number = tone.noteStart;
				const noteEnd: number = tone.noteEnd;
				
				let endPinIndex: number;
				for (endPinIndex = 1; endPinIndex < note.pins.length - 1; endPinIndex++) {
					if (note.pins[endPinIndex].time + note.start > time) break;
				}
				const startPin: NotePin = note.pins[endPinIndex-1];
				const endPin: NotePin = note.pins[endPinIndex];
				const noteStartTick: number = noteStart * Config.ticksPerPart;
				const noteEndTick:   number = noteEnd   * Config.ticksPerPart;
				const noteLengthTicks: number = noteEndTick - noteStartTick;
				const pinStart: number  = (note.start + startPin.time) * Config.ticksPerPart;
				const pinEnd:   number  = (note.start +   endPin.time) * Config.ticksPerPart;
				
				tone.lastInterval = note.pins[note.pins.length - 1].interval;
				tone.lastNoteExpression = note.pins[note.pins.length - 1].expression;
				tone.ticksSinceReleased = 0;
				tone.noteLengthTicks = noteLengthTicks;
				
				const tickTimeStart: number = time * Config.ticksPerPart + synth.tick;
				const tickTimeEnd:   number = time * Config.ticksPerPart + synth.tick + 1;
				const noteTicksPassedTickStart: number = tickTimeStart - noteStartTick;
				const noteTicksPassedTickEnd: number = tickTimeEnd - noteStartTick;
				const pinRatioStart: number = Math.min(1.0, (tickTimeStart - pinStart) / (pinEnd - pinStart));
				const pinRatioEnd:   number = Math.min(1.0, (tickTimeEnd   - pinStart) / (pinEnd - pinStart));
				let noteExpressionTickStart: number = startPin.expression + (endPin.expression - startPin.expression) * pinRatioStart;
				let noteExpressionTickEnd:   number = startPin.expression + (endPin.expression - startPin.expression) * pinRatioEnd;
				let transitionExpressionTickStart: number = 1.0;
				let transitionExpressionTickEnd:   number = 1.0;
				let chordExpressionTickStart: number = chordExpression;
				let chordExpressionTickEnd:   number = chordExpression;
				let intervalTickStart: number = startPin.interval + (endPin.interval - startPin.interval) * pinRatioStart;
				let intervalTickEnd:   number = startPin.interval + (endPin.interval - startPin.interval) * pinRatioEnd;
				let decayTimeTickStart: number = partTimeTickStart - noteStart;
				let decayTimeTickEnd:   number = partTimeTickEnd - noteStart;
				
				resetPhases = (tickTimeStart + startRatio - noteStartTick == 0.0) || !toneWasActive;
				
				// if seamless, don't reset phases at start. (it's probably not necessary to constantly reset phases if there are no notes? Just do it once when note starts? But make sure that reset phases doesn't also reset stuff that this function did to set up the tone. Remember when the first run length was lost!
				// if slide, average the interval, decayTime, and custom expression at the endpoints and interpolate between over slide duration.
				// note that currently seamless and slide make different assumptions about whether a note at the end of a bar will connect with the next bar!
				const maximumSlideTicks: number = noteLengthTicks * 0.5;
				if (transition.isSeamless && !transition.slides && note.start == 0) {
					// Special case for seamless, no-slide transition: assume the previous bar ends with another seamless note, don't reset tone history.
					resetPhases = !toneWasActive;
				} else if (transition.isSeamless && prevNote != null) {
					resetPhases = !toneWasActive;
					if (transition.slides) {
						const slideTicks: number = Math.min(maximumSlideTicks, transition.slideTicks);
						const slideRatioStartTick: number = Math.max(0.0, 1.0 - noteTicksPassedTickStart / slideTicks);
						const slideRatioEndTick:   number = Math.max(0.0, 1.0 - noteTicksPassedTickEnd / slideTicks);
						const intervalDiff: number = ((prevNote.pitches[tone.prevNotePitchIndex] + prevNote.pins[prevNote.pins.length-1].interval) - tone.pitches[0]) * 0.5;
						const expressionDiff: number = (prevNote.pins[prevNote.pins.length-1].expression - note.pins[0].expression) * 0.5;
						const decayTimeDiff: number = (prevNote.end - prevNote.start) * 0.5;
						intervalTickStart += slideRatioStartTick * intervalDiff;
						intervalTickEnd += slideRatioEndTick * intervalDiff;
						noteExpressionTickStart += slideRatioStartTick * expressionDiff;
						noteExpressionTickEnd += slideRatioEndTick * expressionDiff;
						decayTimeTickStart += slideRatioStartTick * decayTimeDiff;
						decayTimeTickEnd += slideRatioEndTick * decayTimeDiff;
						
						if (!chord.arpeggiates) {
							const chordSizeDiff: number = (prevNote.pitches.length - tone.chordSize) * 0.5;
							chordExpressionTickStart = Synth.computeChordExpression(tone.chordSize + slideRatioStartTick * chordSizeDiff);
							chordExpressionTickEnd = Synth.computeChordExpression(tone.chordSize + slideRatioEndTick * chordSizeDiff);
						}
					}
				}
				if (transition.isSeamless && !transition.slides && note.end == partsPerBar) {
					// Special case for seamless, no-slide transition: assume the next bar starts with another seamless note, don't fade out.
				} else if (transition.isSeamless && nextNote != null) {
					if (transition.slides) {
						const slideTicks: number = Math.min(maximumSlideTicks, transition.slideTicks);
						const slideRatioStartTick: number = Math.max(0.0, 1.0 - (noteLengthTicks - noteTicksPassedTickStart) / slideTicks);
						const slideRatioEndTick:   number = Math.max(0.0, 1.0 - (noteLengthTicks - noteTicksPassedTickEnd) / slideTicks);
						const intervalDiff: number = (nextNote.pitches[tone.nextNotePitchIndex] - (tone.pitches[0] + note.pins[note.pins.length-1].interval)) * 0.5;
						const expressionDiff: number = (nextNote.pins[0].expression - note.pins[note.pins.length-1].expression) * 0.5;
						const decayTimeDiff: number = -(noteEnd - noteStart) * 0.5;
						intervalTickStart += slideRatioStartTick * intervalDiff;
						intervalTickEnd += slideRatioEndTick * intervalDiff;
						noteExpressionTickStart += slideRatioStartTick * expressionDiff;
						noteExpressionTickEnd += slideRatioEndTick * expressionDiff;
						decayTimeTickStart += slideRatioStartTick * decayTimeDiff;
						decayTimeTickEnd += slideRatioEndTick * decayTimeDiff;
						
						if (!chord.arpeggiates) {
							const chordSizeDiff: number = (nextNote.pitches.length - tone.chordSize) * 0.5;
							chordExpressionTickStart = Synth.computeChordExpression(tone.chordSize + slideRatioStartTick * chordSizeDiff);
							chordExpressionTickEnd = Synth.computeChordExpression(tone.chordSize + slideRatioEndTick * chordSizeDiff);
						}
					}
				} else if (!transition.releases) {
					const releaseTicks: number = transition.releaseTicks;
					if (releaseTicks > 0.0) {
						transitionExpressionTickStart *= Math.min(1.0, (noteLengthTicks - noteTicksPassedTickStart) / releaseTicks);
						transitionExpressionTickEnd   *= Math.min(1.0, (noteLengthTicks - noteTicksPassedTickEnd) / releaseTicks);
						if (tickTimeEnd >= noteStartTick + noteLengthTicks) toneIsOnLastTick = true;
					}
				}
				
				intervalStart = intervalTickStart + (intervalTickEnd - intervalTickStart) * startRatio;
				intervalEnd   = intervalTickStart + (intervalTickEnd - intervalTickStart) * endRatio;
				noteExpressionStart = Synth.expressionToVolumeMult(noteExpressionTickStart + (noteExpressionTickEnd - noteExpressionTickStart) * startRatio);
				noteExpressionEnd   = Synth.expressionToVolumeMult(noteExpressionTickStart + (noteExpressionTickEnd - noteExpressionTickStart) * endRatio);
				transitionExpressionStart = transitionExpressionTickStart + (transitionExpressionTickEnd - transitionExpressionTickStart) * startRatio;
				transitionExpressionEnd   = transitionExpressionTickStart + (transitionExpressionTickEnd - transitionExpressionTickStart) * endRatio;
				chordExpressionStart = chordExpressionTickStart + (chordExpressionTickEnd - chordExpressionTickStart) * startRatio;
				chordExpressionEnd = chordExpressionTickStart + (chordExpressionTickEnd - chordExpressionTickStart) * endRatio;
				decayTimeStart = decayTimeTickStart + (decayTimeTickEnd - decayTimeTickStart) * startRatio;
				decayTimeEnd   = decayTimeTickStart + (decayTimeTickEnd - decayTimeTickStart) * endRatio;
			}
			
			const sampleTime: number = 1.0 / synth.samplesPerSecond;
			tone.active = true;
			
			if (instrument.type == InstrumentType.chip || instrument.type == InstrumentType.fm || instrument.type == InstrumentType.harmonics || instrument.type == InstrumentType.pwm || instrument.type == InstrumentType.guitar) {
				// Smoothly interpolate between the vibrato LFO curve at the end of the bar and the beginning of the next one. (Mostly to avoid a discontinuous frequency which retriggers guitar string plucking.)
				let lfoStart: number = Synth.getLFOAmplitude(instrument, secondsPerPart * partTimeStart);
				let lfoEnd:   number = Synth.getLFOAmplitude(instrument, secondsPerPart * partTimeEnd);
				const wrapT: number = Math.max(0.0, Math.min(1.0, 1.0 - (partsPerBar - partTimeStart) / 2.0));
				if (wrapT > 0.0) {
					const lfoWrappedStart: number = Synth.getLFOAmplitude(instrument, secondsPerPart * (partTimeStart - partsPerBar));
					const lfoWrappedEnd:   number = Synth.getLFOAmplitude(instrument, secondsPerPart * (partTimeEnd - partsPerBar));
					lfoStart += (lfoWrappedStart - lfoStart) * wrapT;
					lfoEnd += (lfoWrappedEnd - lfoEnd) * wrapT;
				}
				
				const ticksUntilVibratoStart: number = Config.vibratos[instrument.vibrato].delayTicks - decayTimeStart;
				const ticksUntilVibratoEnd: number = Config.vibratos[instrument.vibrato].delayTicks - decayTimeEnd;
				const vibratoScaleStart: number = Math.max(0.0, Math.min(1.0, 1.0 - ticksUntilVibratoStart / 2.0));
				const vibratoScaleEnd: number = Math.max(0.0, Math.min(1.0, 1.0 - ticksUntilVibratoEnd / 2.0));
				
				const vibratoAmplitude: number = Config.vibratos[instrument.vibrato].amplitude;
				const vibratoStart: number = vibratoScaleStart * lfoStart * vibratoAmplitude;
				const vibratoEnd:   number = vibratoScaleEnd * lfoEnd * vibratoAmplitude;
				intervalStart += vibratoStart;
				intervalEnd   += vibratoEnd;
			}
			
			if (!transition.isSeamless || (!(!transition.slides && tone.note != null && tone.note.start == 0) && !(tone.prevNote != null))) {
				const attackSeconds: number = transition.attackSeconds;
				if (attackSeconds > 0.0) {
					transitionExpressionStart *= Math.min(1.0, secondsPerPart * decayTimeStart / attackSeconds);
					transitionExpressionEnd   *= Math.min(1.0, secondsPerPart * decayTimeEnd / attackSeconds);
				}
			}
			
			if (resetPhases) {
				tone.reset();
			}
			
			if (instrument.type == InstrumentType.drumset) {
				// It's possible that the note will change while the user is editing it,
				// but the tone's pitches don't get updated because the tone has already
				// ended and is fading out. To avoid an array index out of bounds error, clamp the pitch.
				tone.drumsetPitch = tone.pitches[0];
				if (tone.note != null) tone.drumsetPitch += tone.note.pickMainInterval();
				tone.drumsetPitch = Math.max(0, Math.min(Config.drumCount - 1, tone.drumsetPitch));
			}
			
			// TODO: Oh dear this is gonna be awkward to handle... And it should be inverted for highpass?
			// I guess the envelope type and speed should be passed in to getVolumeCompensationMult()...
			// Oh but there may be an unbounded number of these! And they may be multiplied by other envelopes!
			// And the envelope should have no effect if there's no filter control points!
			// And how does it interact with drumset?
			let filterExpression: number = 1.0;
			const filterEnvelope: Envelope = (instrument.type == InstrumentType.drumset) ? instrument.getDrumsetEnvelope(tone.drumsetPitch) : instrument.getFilterEnvelope();
			if (filterEnvelope.type == EnvelopeType.decay) {
				filterExpression *= (1.25 + .025 * filterEnvelope.speed);
			} else if (filterEnvelope.type == EnvelopeType.twang) {
				filterExpression *= (1 + .02 * filterEnvelope.speed);
			}
			
			// TODO: separate envelopes for each control point's freq or gain.
			const filterEnvelopeStart: number = (instrument.type == InstrumentType.drumset) ? 1.0 : Synth.computeEnvelope(filterEnvelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, noteExpressionStart);
			const filterEnvelopeEnd: number = (instrument.type == InstrumentType.drumset) ? 1.0 : Synth.computeEnvelope(filterEnvelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, noteExpressionEnd);
			const drumsetFilterEnvelopeStart: number = (instrument.type != InstrumentType.drumset) ? 1.0 : Synth.computeEnvelope(filterEnvelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, noteExpressionStart);
			const drumsetFilterEnvelopeEnd: number = (instrument.type != InstrumentType.drumset) ? 1.0 : Synth.computeEnvelope(filterEnvelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, noteExpressionEnd);
			
			const filterSettings: FilterSettings = instrument.filter;
			for (let i: number = 0; i < filterSettings.controlPointCount; i++) {
				const point: FilterControlPoint = filterSettings.controlPoints[i];
				point.toCoefficients(Synth.tempFilterStartCoefficients, synth.samplesPerSecond, filterEnvelopeStart, 1.0, 1.0);
				point.toCoefficients(Synth.tempFilterEndCoefficients, synth.samplesPerSecond, filterEnvelopeEnd, 1.0, 1.0);
				if (tone.filters.length <= i) tone.filters[i] = new DynamicBiquadFilter();
				tone.filters[i].loadCoefficientsWithGradient(Synth.tempFilterStartCoefficients, Synth.tempFilterEndCoefficients, 1.0 / runLength);
				filterExpression *= point.getVolumeCompensationMult();
			}
			tone.filterCount = filterSettings.controlPointCount;
			
			if (instrument.type == InstrumentType.drumset) {
				const point: FilterControlPoint = synth.tempDrumSetControlPoint;
				point.type = FilterType.lowPass;
				point.gain = FilterControlPoint.getRoundedSettingValueFromLinearGain(0.5);
				point.freq = FilterControlPoint.getRoundedSettingValueFromHz(8000.0);
				// Drumset envelopes are warped to better imitate the legacy simplified 2nd order lowpass at ~48000Hz that I used to use.
				point.toCoefficients(Synth.tempFilterStartCoefficients, synth.samplesPerSecond, drumsetFilterEnvelopeStart * (1.0 + drumsetFilterEnvelopeStart), 1.0, 1.0);
				point.toCoefficients(Synth.tempFilterEndCoefficients, synth.samplesPerSecond, drumsetFilterEnvelopeEnd * (1.0 + drumsetFilterEnvelopeEnd), 1.0, 1.0);
				if (tone.filters.length == tone.filterCount) tone.filters[tone.filterCount] = new DynamicBiquadFilter();
				tone.filters[tone.filterCount].loadCoefficientsWithGradient(Synth.tempFilterStartCoefficients, Synth.tempFilterEndCoefficients, 1.0 / runLength);
				tone.filterCount++;
			}
			filterExpression = Math.min(3.0, filterExpression);
			
			if (instrument.type == InstrumentType.fm) {
				// phase modulation!
				
				let sineExpressionBoost: number = 1.0;
				let totalCarrierExpression: number = 0.0;

				let arpeggioInterval: number = 0;
				const arpeggiates: boolean = chord.arpeggiates && !chord.customInterval;
				if (tone.pitchCount > 1 && arpeggiates) {
					const arpeggio: number = Math.floor((synth.tick + synth.part * Config.ticksPerPart) / Config.rhythms[song.rhythm].ticksPerArpeggio);
					arpeggioInterval = tone.pitches[getArpeggioPitchIndex(tone.pitchCount, song.rhythm, arpeggio)] - tone.pitches[0];
				}
				
				const carrierCount: number = Config.algorithms[instrument.algorithm].carrierCount;
				for (let i: number = 0; i < Config.operatorCount; i++) {
					const associatedCarrierIndex: number = Config.algorithms[instrument.algorithm].associatedCarrier[i] - 1;
					const pitch: number = tone.pitches[arpeggiates ? 0 : ((i < tone.pitchCount) ? i : ((associatedCarrierIndex < tone.pitchCount) ? associatedCarrierIndex : 0))];
					const freqMult = Config.operatorFrequencies[instrument.operators[i].frequency].mult;
					const interval = Config.operatorCarrierInterval[associatedCarrierIndex] + arpeggioInterval;
					const startPitch: number = basePitch + (pitch + intervalStart) * intervalScale + interval;
					const startFreq: number = freqMult * (Instrument.frequencyFromPitch(startPitch)) + Config.operatorFrequencies[instrument.operators[i].frequency].hzOffset;
					
					tone.phaseDeltas[i] = startFreq * sampleTime * Config.sineWaveLength;
					
					const amplitudeCurve: number = Synth.operatorAmplitudeCurve(instrument.operators[i].amplitude);
					const amplitudeMult: number = amplitudeCurve * Config.operatorFrequencies[instrument.operators[i].frequency].amplitudeSign;
					let expressionStart: number = amplitudeMult;
					let expressionEnd: number = amplitudeMult;
					if (i < carrierCount) {
						// carrier
						const endPitch: number = basePitch + (pitch + intervalEnd) * intervalScale + interval;
						const pitchExpressionStart: number = Math.pow(2.0, -(startPitch - expressionReferencePitch) / pitchDamping);
						const pitchExpressionEnd: number   = Math.pow(2.0,   -(endPitch - expressionReferencePitch) / pitchDamping);
						expressionStart *= baseExpression * pitchExpressionStart * transitionExpressionStart * filterExpression * chordExpressionStart;
						expressionEnd *= baseExpression * pitchExpressionEnd * transitionExpressionEnd * filterExpression * chordExpressionEnd;
						
						totalCarrierExpression += amplitudeCurve;
					} else {
						// modulator
						expressionStart *= Config.sineWaveLength * 1.5;
						expressionEnd *= Config.sineWaveLength * 1.5;
						
						sineExpressionBoost *= 1.0 - Math.min(1.0, instrument.operators[i].amplitude / 15);
					}
					const operatorEnvelope: Envelope = Config.envelopes[instrument.operators[i].envelope];
					
					expressionStart *= Synth.computeEnvelope(operatorEnvelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, noteExpressionStart);
					expressionEnd *= Synth.computeEnvelope(operatorEnvelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, noteExpressionEnd);
					
					tone.expressionStarts[i] = expressionStart;
					tone.expressionDeltas[i] = (expressionEnd - expressionStart) / runLength;
				}
				
				sineExpressionBoost *= (Math.pow(2.0, (2.0 - 1.4 * instrument.feedbackAmplitude / 15.0)) - 1.0) / 3.0;
				sineExpressionBoost *= 1.0 - Math.min(1.0, Math.max(0.0, totalCarrierExpression - 1) / 2.0);
				sineExpressionBoost = 1.0 + sineExpressionBoost * 3.0;
				for (let i: number = 0; i < carrierCount; i++) {
					tone.expressionStarts[i] *= sineExpressionBoost;
					tone.expressionDeltas[i] *= sineExpressionBoost;
				}
				
				// TODO: Default to applying noteExpression to carrier tone.expression if
				// not otherwise used, like other instruments. Currently it's only applied
				// to carriers if the "custom" envelope is explicitly used. Need to
				// preserve the existing behavior if there aren't any existing "custom"
				// envelopes by redirecting the noteExpression to an empty target.
				
				const feedbackAmplitude: number = Config.sineWaveLength * 0.3 * instrument.feedbackAmplitude / 15.0;
				const feedbackEnvelope: Envelope = Config.envelopes[instrument.feedbackEnvelope];
				let feedbackStart: number = feedbackAmplitude * Synth.computeEnvelope(feedbackEnvelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, noteExpressionStart);
				let feedbackEnd: number = feedbackAmplitude * Synth.computeEnvelope(feedbackEnvelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, noteExpressionEnd);
				tone.feedbackMult = feedbackStart;
				tone.feedbackDelta = (feedbackEnd - tone.feedbackMult) / runLength;
			} else if (instrument.type == InstrumentType.guitar) {
				// Increase expression to compensate for string decay.
				const decayExpression: number = Math.pow(2.0, 0.7 * (1.0 - instrument.sustain / (Config.sustainRange - 1)));
				
				for (let pitchIndex: number =  0; pitchIndex < tone.pitchCount; pitchIndex++) {
					let pitch: number = tone.pitches[pitchIndex];
					if (chord.arpeggiates) {
						if (pitchIndex > 0) break;
						const arpeggio: number = Math.floor((synth.tick + synth.part * Config.ticksPerPart) / Config.rhythms[song.rhythm].ticksPerArpeggio);
						pitch = tone.pitches[getArpeggioPitchIndex(tone.pitchCount, song.rhythm, arpeggio)];
					}
					
					const startPitch: number = basePitch + (pitch + intervalStart) * intervalScale;
					const endPitch: number = basePitch + (pitch + intervalEnd) * intervalScale;
					tone.phaseDeltas[pitchIndex] = Instrument.frequencyFromPitch(startPitch) * sampleTime;
					const pitchExpressionStart: number = Math.pow(2.0, -(startPitch - expressionReferencePitch) / pitchDamping);
					const pitchExpressionEnd: number   = Math.pow(2.0,   -(endPitch - expressionReferencePitch) / pitchDamping);
					
					let expressionStart: number = baseExpression * chordExpressionStart * transitionExpressionStart * filterExpression * pitchExpressionStart * decayExpression;
					let expressionEnd: number = baseExpression * chordExpressionEnd * transitionExpressionEnd * filterExpression * pitchExpressionEnd * decayExpression;
					if (filterEnvelope.type != EnvelopeType.custom) {
						expressionStart *= noteExpressionStart;
						expressionEnd *= noteExpressionEnd;
					}
					tone.expressionStarts[pitchIndex] = expressionStart;
					tone.expressionDeltas[pitchIndex] = (expressionEnd - expressionStart) / runLength;
				}
				
				tone.pulseWidth = getPulseWidthRatio(instrument.pulseWidth);
			} else {
				let pitch: number = tone.pitches[0];

				if (tone.pitchCount > 1 && chord.arpeggiates) {
					const arpeggio: number = Math.floor((synth.tick + synth.part * Config.ticksPerPart) / Config.rhythms[song.rhythm].ticksPerArpeggio);
					if (chord.customInterval) {
						const intervalOffset: number = tone.pitches[1 + getArpeggioPitchIndex(tone.pitchCount - 1, song.rhythm, arpeggio)] - tone.pitches[0];
						tone.intervalMult = Math.pow(2.0, intervalOffset / 12.0);
						tone.intervalExpressionMult = Math.pow(2.0, -intervalOffset / pitchDamping);
					} else {
						pitch = tone.pitches[getArpeggioPitchIndex(tone.pitchCount, song.rhythm, arpeggio)];
					}
				}
				
				const startPitch: number = basePitch + (pitch + intervalStart) * intervalScale;
				const endPitch: number = basePitch + (pitch + intervalEnd) * intervalScale;
				const startFreq: number = Instrument.frequencyFromPitch(startPitch);
				
				tone.phaseDeltas[0] = startFreq * sampleTime;
				
				const pitchExpressionStart: number = Math.pow(2.0, -(startPitch - expressionReferencePitch) / pitchDamping);
				const pitchExpressionEnd: number   = Math.pow(2.0,   -(endPitch - expressionReferencePitch) / pitchDamping);
				let settingsExpressionMult: number = baseExpression;
				if (instrument.type == InstrumentType.noise) {
					settingsExpressionMult *= Config.chipNoises[instrument.chipNoise].expression;
				}
				if (instrument.type == InstrumentType.chip) {
					settingsExpressionMult *= Config.chipWaves[instrument.chipWave].expression;
				}
				if (instrument.type == InstrumentType.chip || instrument.type == InstrumentType.harmonics) {
					settingsExpressionMult *= Config.intervals[instrument.interval].expression;
				}
				if (instrument.type == InstrumentType.pwm) {
					const pulseEnvelope: Envelope = Config.envelopes[instrument.pulseEnvelope];
					const basePulseWidth: number = getPulseWidthRatio(instrument.pulseWidth);
					const pulseWidthStart: number = basePulseWidth * Synth.computeEnvelope(pulseEnvelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, noteExpressionStart);
					const pulseWidthEnd: number = basePulseWidth * Synth.computeEnvelope(pulseEnvelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, noteExpressionEnd);
					
					tone.pulseWidth = pulseWidthStart;
					tone.pulseWidthDelta = (pulseWidthEnd - pulseWidthStart) / runLength;
				}
				
				let expressionStart: number = settingsExpressionMult * transitionExpressionStart * chordExpressionStart * pitchExpressionStart * filterExpression;
				let expressionEnd: number = settingsExpressionMult * transitionExpressionEnd * chordExpressionEnd * pitchExpressionEnd * filterExpression;
				if (filterEnvelope.type != EnvelopeType.custom && (instrument.type != InstrumentType.pwm || Config.envelopes[instrument.pulseEnvelope].type != EnvelopeType.custom)) {
					expressionStart *= noteExpressionStart;
					expressionEnd *= noteExpressionEnd;
				}
				
				tone.expressionStarts[0] = expressionStart;
				tone.expressionDeltas[0] = (expressionEnd - expressionStart) / runLength;
			}
			
			tone.phaseDeltaScale = Math.pow(2.0, ((intervalEnd - intervalStart) * intervalScale / 12.0) / runLength);
			tone.isOnLastTick = toneIsOnLastTick;
		}
		
		public static getLFOAmplitude(instrument: Instrument, secondsIntoBar: number): number {
			let effect: number = 0.0;
			for (const vibratoPeriodSeconds of Config.vibratos[instrument.vibrato].periodsSeconds) {
				effect += Math.sin(Math.PI * 2.0 * secondsIntoBar / vibratoPeriodSeconds);
			}
			return effect;
		}
		
		private static getInstrumentSynthFunction(instrument: Instrument): Function {
			if (instrument.type == InstrumentType.fm) {
				const fingerprint: string = instrument.algorithm + "_" + instrument.feedbackType;
				if (Synth.fmSynthFunctionCache[fingerprint] == undefined) {
					const synthSource: string[] = [];
					
					for (const line of Synth.fmSourceTemplate) {
						if (line.indexOf("// CARRIER OUTPUTS") != -1) {
							const outputs: string[] = [];
							for (let j: number = 0; j < Config.algorithms[instrument.algorithm].carrierCount; j++) {
								outputs.push("operator" + j + "Scaled");
							}
							synthSource.push(line.replace("/*operator#Scaled*/", outputs.join(" + ")));
						} else if (line.indexOf("// INSERT OPERATOR COMPUTATION HERE") != -1) {
							for (let j: number = Config.operatorCount - 1; j >= 0; j--) {
								for (const operatorLine of Synth.operatorSourceTemplate) {
									if (operatorLine.indexOf("/* + operator@Scaled*/") != -1) {
										let modulators = "";
										for (const modulatorNumber of Config.algorithms[instrument.algorithm].modulatedBy[j]) {
											modulators += " + operator" + (modulatorNumber - 1) + "Scaled";
										}
									
										const feedbackIndices: ReadonlyArray<number> = Config.feedbacks[instrument.feedbackType].indices[j];
										if (feedbackIndices.length > 0) {
											modulators += " + feedbackMult * (";
											const feedbacks: string[] = [];
											for (const modulatorNumber of feedbackIndices) {
												feedbacks.push("operator" + (modulatorNumber - 1) + "Output");
											}
											modulators += feedbacks.join(" + ") + ")";
										}
										synthSource.push(operatorLine.replace(/\#/g, j + "").replace("/* + operator@Scaled*/", modulators));
									} else {
										synthSource.push(operatorLine.replace(/\#/g, j + ""));
									}
								}
							}
						} else if (line.indexOf("#") != -1) {
							for (let j: number = 0; j < Config.operatorCount; j++) {
								synthSource.push(line.replace(/\#/g, j + ""));
							}
						} else {
							synthSource.push(line);
						}
					}
					
					//console.log(synthSource.join("\n"));
					
					Synth.fmSynthFunctionCache[fingerprint] = new Function("synth", "bufferIndex", "runLength", "tone", "instrument", synthSource.join("\n"));
				}
				return Synth.fmSynthFunctionCache[fingerprint];
			} else if (instrument.type == InstrumentType.chip) {
				return Synth.chipSynth;
			} else if (instrument.type == InstrumentType.harmonics) {
				return Synth.harmonicsSynth;
			} else if (instrument.type == InstrumentType.pwm) {
				return Synth.pulseWidthSynth;
			} else if (instrument.type == InstrumentType.guitar) {
				return Synth.guitarSynth;
			} else if (instrument.type == InstrumentType.noise) {
				return Synth.noiseSynth;
			} else if (instrument.type == InstrumentType.spectrum) {
				return Synth.spectrumSynth;
			} else if (instrument.type == InstrumentType.drumset) {
				return Synth.drumsetSynth;
			} else {
				throw new Error("Unrecognized instrument type: " + instrument.type);
			}
		}
		
		private static chipSynth(synth: Synth, bufferIndex: number, runLength: number, tone: Tone, instrument: Instrument): void {
			const data: Float32Array = synth.tempMonoInstrumentSampleBuffer!;
			const wave: Float64Array = Config.chipWaves[instrument.chipWave].samples;
			const waveLength: number = wave.length - 1; // The first sample is duplicated at the end, don't double-count it.
			
			const intervalA: number = +Math.pow(2.0, (Config.intervals[instrument.interval].offset + Config.intervals[instrument.interval].spread) / 12.0);
			const intervalB: number =  Math.pow(2.0, (Config.intervals[instrument.interval].offset - Config.intervals[instrument.interval].spread) / 12.0) * tone.intervalMult;
			const intervalSign: number = tone.intervalExpressionMult * Config.intervals[instrument.interval].sign;
			if (instrument.interval == 0 && !instrument.getChord().customInterval) tone.phases[1] = tone.phases[0];
			const deltaRatio: number = intervalB / intervalA;
			let phaseDeltaA: number = tone.phaseDeltas[0] * intervalA * waveLength;
			let phaseDeltaB: number = phaseDeltaA * deltaRatio;
			const phaseDeltaScale: number = +tone.phaseDeltaScale;
			let expression: number = +tone.expressionStarts[0];
			const expressionDelta: number = +tone.expressionDeltas[0];
			let phaseA: number = (tone.phases[0] % 1) * waveLength;
			let phaseB: number = (tone.phases[1] % 1) * waveLength;
			
			const filters: DynamicBiquadFilter[] = tone.filters;
			const filterCount: number = tone.filterCount|0;
			let initialFilterInput1: number = +tone.initialFilterInput1;
			let initialFilterInput2: number = +tone.initialFilterInput2;
			
			const phaseAInt: number = phaseA|0;
			const phaseBInt: number = phaseB|0;
			const indexA: number = phaseAInt % waveLength;
			const indexB: number = phaseBInt % waveLength;
			const phaseRatioA: number = phaseA - phaseAInt;
			const phaseRatioB: number = phaseB - phaseBInt;
			let prevWaveIntegralA: number = +wave[indexA];
			let prevWaveIntegralB: number = +wave[indexB];
			prevWaveIntegralA += (wave[indexA+1] - prevWaveIntegralA) * phaseRatioA;
			prevWaveIntegralB += (wave[indexB+1] - prevWaveIntegralB) * phaseRatioB;
			
			const stopIndex: number = bufferIndex + runLength;
			for (let sampleIndex: number = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
				
				phaseA += phaseDeltaA;
				phaseB += phaseDeltaB;
				
				const phaseAInt: number = phaseA|0;
				const phaseBInt: number = phaseB|0;
				const indexA: number = phaseAInt % waveLength;
				const indexB: number = phaseBInt % waveLength;
				let nextWaveIntegralA: number = wave[indexA];
				let nextWaveIntegralB: number = wave[indexB];
				const phaseRatioA: number = phaseA - phaseAInt;
				const phaseRatioB: number = phaseB - phaseBInt;
				nextWaveIntegralA += (wave[indexA+1] - nextWaveIntegralA) * phaseRatioA;
				nextWaveIntegralB += (wave[indexB+1] - nextWaveIntegralB) * phaseRatioB;
				const waveA: number = (nextWaveIntegralA - prevWaveIntegralA) / phaseDeltaA;
				const waveB: number = (nextWaveIntegralB - prevWaveIntegralB) / phaseDeltaB;
				prevWaveIntegralA = nextWaveIntegralA;
				prevWaveIntegralB = nextWaveIntegralB;
				
				const inputSample: number = waveA + waveB * intervalSign;
				const sample: number = synth.applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
				initialFilterInput2 = initialFilterInput1;
				initialFilterInput1 = inputSample;
				
				phaseDeltaA *= phaseDeltaScale;
				phaseDeltaB *= phaseDeltaScale;
				
				const output: number = sample * expression;
				expression += expressionDelta;
				
				data[sampleIndex] += output;
			}
			
			tone.phases[0] = phaseA / waveLength;
			tone.phases[1] = phaseB / waveLength;
			
			synth.sanitizeFilters(filters);
			tone.initialFilterInput1 = initialFilterInput1;
			tone.initialFilterInput2 = initialFilterInput2;
		}
		
		private static harmonicsSynth(synth: Synth, bufferIndex: number, runLength: number, tone: Tone, instrument: Instrument): void {
			const data: Float32Array = synth.tempMonoInstrumentSampleBuffer!;
			const wave: Float32Array = instrument.harmonicsWave.getCustomWave();
			const waveLength: number = wave.length - 1; // The first sample is duplicated at the end, don't double-count it.
			
			const intervalA: number = +Math.pow(2.0, (Config.intervals[instrument.interval].offset + Config.intervals[instrument.interval].spread) / 12.0);
			const intervalB: number =  Math.pow(2.0, (Config.intervals[instrument.interval].offset - Config.intervals[instrument.interval].spread) / 12.0) * tone.intervalMult;
			const intervalSign: number = tone.intervalExpressionMult * Config.intervals[instrument.interval].sign;
			if (instrument.interval == 0 && !instrument.getChord().customInterval) tone.phases[1] = tone.phases[0];
			const deltaRatio: number = intervalB / intervalA;
			let phaseDeltaA: number = tone.phaseDeltas[0] * intervalA * waveLength;
			let phaseDeltaB: number = phaseDeltaA * deltaRatio;
			const phaseDeltaScale: number = +tone.phaseDeltaScale;
			let expression: number = +tone.expressionStarts[0];
			const expressionDelta: number = +tone.expressionDeltas[0];
			let phaseA: number = (tone.phases[0] % 1) * waveLength;
			let phaseB: number = (tone.phases[1] % 1) * waveLength;
			
			const filters: DynamicBiquadFilter[] = tone.filters;
			const filterCount: number = tone.filterCount|0;
			let initialFilterInput1: number = +tone.initialFilterInput1;
			let initialFilterInput2: number = +tone.initialFilterInput2;
			
			const phaseAInt: number = phaseA|0;
			const phaseBInt: number = phaseB|0;
			const indexA: number = phaseAInt % waveLength;
			const indexB: number = phaseBInt % waveLength;
			const phaseRatioA: number = phaseA - phaseAInt;
			const phaseRatioB: number = phaseB - phaseBInt;
			let prevWaveIntegralA: number = +wave[indexA];
			let prevWaveIntegralB: number = +wave[indexB];
			prevWaveIntegralA += (wave[indexA+1] - prevWaveIntegralA) * phaseRatioA;
			prevWaveIntegralB += (wave[indexB+1] - prevWaveIntegralB) * phaseRatioB;
			
			const stopIndex: number = bufferIndex + runLength;
			for (let sampleIndex: number = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
				
				phaseA += phaseDeltaA;
				phaseB += phaseDeltaB;
				
				const phaseAInt: number = phaseA|0;
				const phaseBInt: number = phaseB|0;
				const indexA: number = phaseAInt % waveLength;
				const indexB: number = phaseBInt % waveLength;
				let nextWaveIntegralA: number = wave[indexA];
				let nextWaveIntegralB: number = wave[indexB];
				const phaseRatioA: number = phaseA - phaseAInt;
				const phaseRatioB: number = phaseB - phaseBInt;
				nextWaveIntegralA += (wave[indexA+1] - nextWaveIntegralA) * phaseRatioA;
				nextWaveIntegralB += (wave[indexB+1] - nextWaveIntegralB) * phaseRatioB;
				const waveA: number = (nextWaveIntegralA - prevWaveIntegralA) / phaseDeltaA;
				const waveB: number = (nextWaveIntegralB - prevWaveIntegralB) / phaseDeltaB;
				prevWaveIntegralA = nextWaveIntegralA;
				prevWaveIntegralB = nextWaveIntegralB;
				
				const inputSample: number = waveA + waveB * intervalSign;
				const sample: number = synth.applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
				initialFilterInput2 = initialFilterInput1;
				initialFilterInput1 = inputSample;
				
				phaseDeltaA *= phaseDeltaScale;
				phaseDeltaB *= phaseDeltaScale;
				
				const output: number = sample * expression;
				expression += expressionDelta;
				
				data[sampleIndex] += output;
			}
			
			tone.phases[0] = phaseA / waveLength;
			tone.phases[1] = phaseB / waveLength;
			
			synth.sanitizeFilters(filters);
			tone.initialFilterInput1 = initialFilterInput1;
			tone.initialFilterInput2 = initialFilterInput2;
		}
		
		private static guitarSynth(synth: Synth, bufferIndex: number, runLength: number, tone: Tone, instrument: Instrument): void {
			// This algorithm is similar to the Karpluss-Strong algorithm in principle,
			// but an all-pass filter for dispersion and with more control over the impulse.
			
			const data: Float32Array = synth.tempMonoInstrumentSampleBuffer!;
			
			const delayBufferMask: number = synth.guitarDelayBufferMask >>> 0;
			
			const stringDecay: number = 1.0 - instrument.sustain / (Config.sustainRange - 1);
			
			if (tone.guitarString == null) tone.guitarString = new GuitarString();
			let guitarString: GuitarString | null = tone.guitarString;
			
			if (guitarString.delayLine == null || guitarString.delayLine.length < synth.guitarDelayBufferSize) {
				guitarString.delayLine = new Float32Array(synth.guitarDelayBufferSize);
			}
			
			const delayLine: Float32Array = guitarString.delayLine;
			const prevDelayLength: number = +guitarString.prevDelayLength;
			let allPassSample: number = +guitarString.allPassSample;
			let allPassPrevInput: number = +guitarString.allPassPrevInput;
			let shelfSample: number = +guitarString.shelfSample;
			let shelfPrevInput: number = +guitarString.shelfPrevInput;
			let fractionalDelaySample: number = +guitarString.fractionalDelaySample;
			
			let expression: number = +tone.expressionStarts[0];
			const expressionDelta: number = +tone.expressionDeltas[0];
			
			const phaseDeltaStart: number = +tone.phaseDeltas[0];
			const phaseDeltaScale: number = +tone.phaseDeltaScale;
			const phaseDeltaEnd: number = phaseDeltaStart * Math.pow(phaseDeltaScale, runLength);
			
			const radiansPerSampleStart: number = Math.PI * 2.0 * phaseDeltaStart;
			const radiansPerSampleEnd:   number = Math.PI * 2.0 * phaseDeltaEnd;
			
			const centerHarmonicStart: number = radiansPerSampleStart * 2.0;
			const centerHarmonicEnd: number = radiansPerSampleEnd * 2.0;
			
			const allPassCenter: number = 2.0 * Math.PI * Config.guitarDispersionCenterFreq / synth.samplesPerSecond;
			const allPassRadiansStart: number = Math.min(Math.PI, radiansPerSampleStart * Config.guitarDispersionFreqMult * Math.pow(allPassCenter / radiansPerSampleStart, Config.guitarDispersionFreqScale));
			const allPassRadiansEnd: number = Math.min(Math.PI, radiansPerSampleEnd * Config.guitarDispersionFreqMult * Math.pow(allPassCenter / radiansPerSampleEnd, Config.guitarDispersionFreqScale));
			
			Synth.tempFilterStartCoefficients.allPass1stOrderInvertPhaseAbove(allPassRadiansStart);
			synth.tempFrequencyResponse.analyze(Synth.tempFilterStartCoefficients, centerHarmonicStart);
			let allPassG: number = +Synth.tempFilterStartCoefficients.b[0]; // same as a[1]
			const allPassPhaseDelayStart: number = -synth.tempFrequencyResponse.angle() / centerHarmonicStart;
			
			Synth.tempFilterEndCoefficients.allPass1stOrderInvertPhaseAbove(allPassRadiansEnd);
			synth.tempFrequencyResponse.analyze(Synth.tempFilterEndCoefficients, centerHarmonicEnd);
			const allPassGEnd: number = +Synth.tempFilterEndCoefficients.b[0]; // same as a[1]
			const allPassPhaseDelayEnd: number = -synth.tempFrequencyResponse.angle() / centerHarmonicEnd;
			
			const shelfRadians: number = 2.0 * Math.PI * Config.guitarShelfHz / synth.samplesPerSecond;
			const decayCurve: number = 0.2 * stringDecay + 0.8 * Math.pow(stringDecay, 4.0);
			const decayRateStart: number = Math.pow(0.5, decayCurve * shelfRadians / radiansPerSampleStart);
			const decayRateEnd: number = Math.pow(0.5, decayCurve * shelfRadians / radiansPerSampleEnd);
			const shelfGainStart: number = Math.pow(decayRateStart, 0.06);
			const shelfGainEnd: number = Math.pow(decayRateEnd, 0.06);
			const expressionDecayStart: number = Math.pow(decayRateStart, 0.001);
			const expressionDecayEnd: number = Math.pow(decayRateEnd, 0.001);
			
			Synth.tempFilterStartCoefficients.highShelf1stOrder(shelfRadians, shelfGainStart);
			synth.tempFrequencyResponse.analyze(Synth.tempFilterStartCoefficients, centerHarmonicStart);
			let shelfA1: number = +Synth.tempFilterStartCoefficients.a[1];
			let shelfB0: number = Synth.tempFilterStartCoefficients.b[0] * expressionDecayStart;
			let shelfB1: number = Synth.tempFilterStartCoefficients.b[1] * expressionDecayStart;
			const shelfPhaseDelayStart: number = -synth.tempFrequencyResponse.angle() / centerHarmonicStart;
			
			Synth.tempFilterEndCoefficients.highShelf1stOrder(shelfRadians, shelfGainEnd);
			synth.tempFrequencyResponse.analyze(Synth.tempFilterEndCoefficients, centerHarmonicEnd);
			const shelfA1End: number = +Synth.tempFilterEndCoefficients.a[1];
			const shelfB0End: number = Synth.tempFilterEndCoefficients.b[0] * expressionDecayEnd;
			const shelfB1End: number = Synth.tempFilterEndCoefficients.b[1] * expressionDecayEnd;
			const shelfPhaseDelayEnd: number = -synth.tempFrequencyResponse.angle() / centerHarmonicEnd;
			
			const periodLengthStart: number = 1.0 / phaseDeltaStart;
			const periodLengthEnd: number = 1.0 / phaseDeltaEnd;
			let delayLength: number = periodLengthStart - allPassPhaseDelayStart - shelfPhaseDelayStart;
			const delayLengthEnd: number = periodLengthEnd - allPassPhaseDelayEnd - shelfPhaseDelayEnd;
			
			const delayLengthDelta: number = (delayLengthEnd - delayLength) / runLength;
			const allPassGDelta: number = (allPassGEnd - allPassG) / runLength;
			const shelfA1Delta: number = (shelfA1End - shelfA1) / runLength;
			const shelfB0Delta: number = (shelfB0End - shelfB0) / runLength;
			const shelfB1Delta: number = (shelfB1End - shelfB1) / runLength;
			
			const filters: DynamicBiquadFilter[] = tone.filters;
			const filterCount: number = tone.filterCount|0;
			let initialFilterInput1: number = +tone.initialFilterInput1;
			let initialFilterInput2: number = +tone.initialFilterInput2;
			
			const pitchChanged: boolean = Math.abs(Math.log2(delayLength / prevDelayLength)) > 0.01;
			let delayIndex: number = guitarString.delayIndex|0;
			if (delayIndex == -1 || pitchChanged)  {
				// -1 delay index means the tone was reset.
				// Also, if the pitch changed suddenly (e.g. from seamless or arpeggio) then reset the wave.
				
				delayIndex = 0;
				// Clear away a region of the delay buffer for the new impulse.
				const startImpulseFrom: number = -delayLength;
				const startZerosFrom: number = Math.floor(startImpulseFrom - periodLengthStart / 2);
				const stopZerosAt: number = Math.ceil(startZerosFrom + periodLengthStart * 2);
				guitarString.delayResetOffset = stopZerosAt; // And continue clearing the area in front of the delay line.
				for (let i: number = startZerosFrom; i <= stopZerosAt; i++) {
					delayLine[i & delayBufferMask] = 0.0;
				}
				
				allPassSample = 0.0;
				allPassPrevInput = 0.0;
				shelfSample = 0.0;
				shelfPrevInput = 0.0;
				fractionalDelaySample = 0.0;
				
				const impulseWave: Float32Array = GuitarImpulseWave.getWave();
				const impulseWaveLength: number = +impulseWave.length - 1; // The first sample is duplicated at the end, don't double-count it.
				const impulsePhaseDelta: number = impulseWaveLength / periodLengthStart;
				const pulseOffset: number = periodLengthStart * (tone.pulseWidth * (1.0 + (Math.random() - 0.5) * Config.guitarPulseWidthRandomness));
				const impulseExpressionMult: number = 0.5; // Compensate for adding two copies of the wave.
				
				const startFirstWaveFrom: number = startImpulseFrom;
				const startFirstWaveFromSample: number = Math.ceil(startFirstWaveFrom);
				const stopFirstWaveAtSample: number = Math.floor(startImpulseFrom + periodLengthStart);
				const startFirstWavePhase: number = (startFirstWaveFromSample - startFirstWaveFrom) * impulsePhaseDelta;
				const startSecondWaveFrom: number = startFirstWaveFrom + pulseOffset;
				const startSecondWaveFromSample: number = Math.ceil(startSecondWaveFrom);
				const stopSecondWaveAtSample: number = Math.floor(startSecondWaveFrom + periodLengthStart);
				const startSecondWavePhase: number = (startSecondWaveFromSample - startSecondWaveFrom) * impulsePhaseDelta;

				let impulsePhase: number = startFirstWavePhase;
				let prevWaveIntegral: number = 0.0;
				for (let i: number = startFirstWaveFromSample; i <= stopFirstWaveAtSample; i++) {
					const impulsePhaseInt: number = impulsePhase|0;
					const index: number = impulsePhaseInt % impulseWaveLength;
					let nextWaveIntegral: number = impulseWave[index];
					const phaseRatio: number = impulsePhase - impulsePhaseInt;
					nextWaveIntegral += (impulseWave[index+1] - nextWaveIntegral) * phaseRatio;
					const sample: number = (nextWaveIntegral - prevWaveIntegral) / impulsePhaseDelta;
					delayLine[i & delayBufferMask] += sample * impulseExpressionMult;
					prevWaveIntegral = nextWaveIntegral;
					impulsePhase += impulsePhaseDelta;
				}

				impulsePhase = startSecondWavePhase;
				prevWaveIntegral = 0.0;
				for (let i: number = startSecondWaveFromSample; i <= stopSecondWaveAtSample; i++) {
					const impulsePhaseInt: number = impulsePhase|0;
					const index: number = impulsePhaseInt % impulseWaveLength;
					let nextWaveIntegral: number = impulseWave[index];
					const phaseRatio: number = impulsePhase - impulsePhaseInt;
					nextWaveIntegral += (impulseWave[index+1] - nextWaveIntegral) * phaseRatio;
					const sample: number = (nextWaveIntegral - prevWaveIntegral) / impulsePhaseDelta;
					delayLine[i & delayBufferMask] -= sample * impulseExpressionMult;
					prevWaveIntegral = nextWaveIntegral;
					impulsePhase += impulsePhaseDelta;
				}
			}
			delayIndex = (delayIndex & delayBufferMask) + synth.guitarDelayBufferSize;
			
			const delayResetOffset: number = guitarString.delayResetOffset|0;
			
			const stopIndex: number = bufferIndex + runLength;
			for (let sampleIndex: number = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
				const targetSampleTime: number = delayIndex - delayLength;
				const lowerIndex: number = (targetSampleTime + 0.125) | 0; // Offset to improve stability of all-pass filter.
				const upperIndex: number = lowerIndex + 1;
				const fractionalDelay: number = upperIndex - targetSampleTime;
				const fractionalDelayG: number = (1.0 - fractionalDelay) / (1.0 + fractionalDelay); // Inlined version of FilterCoefficients.prototype.allPass1stOrderFractionalDelay
				const prevInput: number = delayLine[lowerIndex & delayBufferMask];
				const input: number = delayLine[upperIndex & delayBufferMask];
				fractionalDelaySample = fractionalDelayG * input + prevInput - fractionalDelayG * fractionalDelaySample;
				
				allPassSample = fractionalDelaySample * allPassG + allPassPrevInput - allPassG * allPassSample;
				allPassPrevInput = fractionalDelaySample;
				
				shelfSample = shelfB0 * allPassSample + shelfB1 * shelfPrevInput - shelfA1 * shelfSample;
				shelfPrevInput = allPassSample;
				
				delayLine[delayIndex & delayBufferMask] += shelfSample;
				delayLine[(delayIndex + delayResetOffset) & delayBufferMask] = 0.0;
				delayIndex++;
				
				const inputSample: number = fractionalDelaySample * expression;
				const sample: number = synth.applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
				initialFilterInput2 = initialFilterInput1;
				initialFilterInput1 = inputSample;
				data[sampleIndex] += sample;
				
				expression += expressionDelta;
				delayLength += delayLengthDelta;
				allPassG += allPassGDelta;
				shelfA1 += shelfA1Delta;
				shelfB0 += shelfB0Delta;
				shelfB1 += shelfB1Delta;
			}
			
			if (!Number.isFinite(allPassSample) || Math.abs(allPassSample) < epsilon) allPassSample = 0.0;
			if (!Number.isFinite(allPassPrevInput) || Math.abs(allPassPrevInput) < epsilon) allPassPrevInput = 0.0;
			if (!Number.isFinite(shelfSample) || Math.abs(shelfSample) < epsilon) shelfSample = 0.0;
			if (!Number.isFinite(shelfPrevInput) || Math.abs(shelfPrevInput) < epsilon) shelfPrevInput = 0.0;
			if (!Number.isFinite(fractionalDelaySample) || Math.abs(fractionalDelaySample) < epsilon) fractionalDelaySample = 0.0;
			guitarString.allPassSample = allPassSample;
			guitarString.allPassPrevInput = allPassPrevInput;
			guitarString.shelfSample = shelfSample;
			guitarString.shelfPrevInput = shelfPrevInput;
			guitarString.fractionalDelaySample = fractionalDelaySample;
			guitarString.delayIndex = delayIndex;
			guitarString.prevDelayLength = delayLength;
			
			synth.sanitizeFilters(filters);
			tone.initialFilterInput1 = initialFilterInput1;
			tone.initialFilterInput2 = initialFilterInput2;
		}
		
		private static effectsSynth(synth: Synth, outputDataL: Float32Array, outputDataR: Float32Array, bufferIndex: number, runLength: number, instrument: Instrument, instrumentState: InstrumentState): void {
			// TODO: If automation is involved, don't assume sliders will stay at zero.
			const usesDistortionEffect: boolean = effectsIncludeDistortion(instrument.effects) && instrument.distortion != 0;
			const usesBitcrusherEffect: boolean = effectsIncludeBitcrusher(instrument.effects);
			const usesPanningEffect: boolean = effectsIncludePanning(instrument.effects) && instrument.pan != Config.panCenter;
			const usesChorusEffect: boolean = effectsIncludeChorus(instrument.effects);
			const usesReverbEffect: boolean = effectsIncludeReverb(instrument.effects) && instrument.reverb != 0;
			let signature: number = 0;
			if (usesDistortionEffect) signature = signature | 1;
			signature = signature << 1;
			if (usesBitcrusherEffect) signature = signature | 1;
			signature = signature << 1;
			if (usesPanningEffect) signature = signature | 1;
			signature = signature << 1;
			if (usesChorusEffect) signature = signature | 1;
			signature = signature << 1;
			if (usesReverbEffect) signature = signature | 1;

			let effectsFunction: Function = Synth.effectsFunctionCache[signature];
			if (effectsFunction == undefined) {
				let effectsSource: string = "";
				
				const usesEffectFilter: boolean = usesDistortionEffect; // TODO: Bitcrusher?
				const usesDelayEffects: boolean = usesChorusEffect || usesReverbEffect;
				
				effectsSource += `
					const tempMonoInstrumentSampleBuffer = synth.tempMonoInstrumentSampleBuffer;
					
					let volume = +instrumentState.volumeStart;
					let volumeDelta = +instrumentState.volumeDelta;`
				
				if (usesDelayEffects) {
					effectsSource += `
					
					let delayInputMult = +instrumentState.delayInputMultStart;
					const delayInputMultDelta = +instrumentState.delayInputMultDelta;`
				}
				
				if (usesDistortionEffect) {
					effectsSource += `
					
					const distortionSlider = instrument.distortion / (beepbox.Config.distortionRange - 1);
					const distortion = Math.pow(1.0 - 0.95 * distortionSlider, 1.5);
					const distortionBaseVolume = beepbox.Config.distortionBaseVolume;
					const amp = (1.0 + 2.0 * distortionSlider) / distortionBaseVolume;`
				}
				
				if (usesBitcrusherEffect) {
					effectsSource += `
					
					let bitcrusherCurrentValue = +instrumentState.bitcrusherCurrentValue;
					let bitcrusherPhase = +instrumentState.bitcrusherPhase;
					let bitcrusherPhaseDelta = +instrumentState.bitcrusherPhaseDelta;
					const bitcrusherPhaseDeltaScale = +instrumentState.bitcrusherPhaseDeltaScale;
					let bitcrusherScale = +instrumentState.bitcrusherScale;
					const bitcrusherScaleDelta = +instrumentState.bitcrusherScaleDelta;`
				}
				
				if (usesEffectFilter) {
					effectsSource += `
					
					let filters = instrumentState.distortionFilters;
					const filterCount = instrumentState.distortionFilterCount|0;
					let initialFilterInput1 = +instrumentState.initialDistortionFilterInput1;
					let initialFilterInput2 = +instrumentState.initialDistortionFilterInput2;`
				}
				
				if (usesPanningEffect) {
					effectsSource += `
					
					const panningMask = synth.panningDelayBufferMask >>> 0;
					const panningDelayLine = instrumentState.panningDelayLine;
					let panningDelayPos = instrumentState.panningDelayPos & panningMask;
					let   panningVolumeL      = +instrumentState.panningVolumeStartL;
					let   panningVolumeR      = +instrumentState.panningVolumeStartR;
					const panningVolumeDeltaL = +instrumentState.panningVolumeDeltaL;
					const panningVolumeDeltaR = +instrumentState.panningVolumeDeltaR;
					let   panningOffsetL      = panningDelayPos - instrumentState.panningOffsetStartL + synth.panningDelayBufferSize;
					let   panningOffsetR      = panningDelayPos - instrumentState.panningOffsetStartR + synth.panningDelayBufferSize;
					const panningOffsetDeltaL = instrumentState.panningOffsetDeltaL + 1.0;
					const panningOffsetDeltaR = instrumentState.panningOffsetDeltaR + 1.0;`
				}
					
				if (usesChorusEffect) {
					effectsSource += `
					
					const chorusMask = synth.chorusDelayBufferMask >>> 0;
					const chorusDelayLineL = instrumentState.chorusDelayLineL;
					const chorusDelayLineR = instrumentState.chorusDelayLineR;
					instrumentState.chorusDelayLineDirty = true;
					let chorusDelayPos = instrumentState.chorusDelayPos & chorusMask;
					
					const chorusDuration = +beepbox.Config.chorusPeriodSeconds;
					const chorusAngle = Math.PI * 2.0 / (chorusDuration * synth.samplesPerSecond);
					const chorusRange = synth.samplesPerSecond * beepbox.Config.chorusDelayRange;
					const chorusOffset0 = synth.chorusDelayBufferSize - beepbox.Config.chorusDelayOffsets[0][0] * chorusRange;
					const chorusOffset1 = synth.chorusDelayBufferSize - beepbox.Config.chorusDelayOffsets[0][1] * chorusRange;
					const chorusOffset2 = synth.chorusDelayBufferSize - beepbox.Config.chorusDelayOffsets[0][2] * chorusRange;
					const chorusOffset3 = synth.chorusDelayBufferSize - beepbox.Config.chorusDelayOffsets[1][0] * chorusRange;
					const chorusOffset4 = synth.chorusDelayBufferSize - beepbox.Config.chorusDelayOffsets[1][1] * chorusRange;
					const chorusOffset5 = synth.chorusDelayBufferSize - beepbox.Config.chorusDelayOffsets[1][2] * chorusRange;
					let chorusPhase = instrumentState.chorusPhase % (Math.PI * 2.0);
					let chorusTap0Index = chorusDelayPos + chorusOffset0 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[0][0]);
					let chorusTap1Index = chorusDelayPos + chorusOffset1 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[0][1]);
					let chorusTap2Index = chorusDelayPos + chorusOffset2 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[0][2]);
					let chorusTap3Index = chorusDelayPos + chorusOffset3 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[1][0]);
					let chorusTap4Index = chorusDelayPos + chorusOffset4 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[1][1]);
					let chorusTap5Index = chorusDelayPos + chorusOffset5 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[1][2]);
					chorusPhase += chorusAngle * runLength;
					const chorusTap0End = chorusDelayPos + chorusOffset0 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[0][0]) + runLength;
					const chorusTap1End = chorusDelayPos + chorusOffset1 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[0][1]) + runLength;
					const chorusTap2End = chorusDelayPos + chorusOffset2 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[0][2]) + runLength;
					const chorusTap3End = chorusDelayPos + chorusOffset3 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[1][0]) + runLength;
					const chorusTap4End = chorusDelayPos + chorusOffset4 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[1][1]) + runLength;
					const chorusTap5End = chorusDelayPos + chorusOffset5 - chorusRange * Math.sin(chorusPhase + beepbox.Config.chorusPhaseOffsets[1][2]) + runLength;
					const chorusTap0Delta = (chorusTap0End - chorusTap0Index) / runLength;
					const chorusTap1Delta = (chorusTap1End - chorusTap1Index) / runLength;
					const chorusTap2Delta = (chorusTap2End - chorusTap2Index) / runLength;
					const chorusTap3Delta = (chorusTap3End - chorusTap3Index) / runLength;
					const chorusTap4Delta = (chorusTap4End - chorusTap4Index) / runLength;
					const chorusTap5Delta = (chorusTap5End - chorusTap5Index) / runLength;`
				}
					
				if (usesReverbEffect) {
					effectsSource += `
					
					const reverbMask = beepbox.Config.reverbDelayBufferMask >>> 0; //TODO: Dynamic reverb buffer size.
					const reverbDelayLine = instrumentState.reverbDelayLine;
					instrumentState.reverbDelayLineDirty = true;
					let reverbDelayPos = instrumentState.reverbDelayPos & reverbMask;
					
					let reverbFeedback0 = +instrumentState.reverbFeedback0;
					let reverbFeedback1 = +instrumentState.reverbFeedback1;
					let reverbFeedback2 = +instrumentState.reverbFeedback2;
					let reverbFeedback3 = +instrumentState.reverbFeedback3;
					
					const reverb = +instrumentState.reverbMult;`
				}
				
				effectsSource += `
					
					const stopIndex = bufferIndex + runLength;
					for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
						let sample = tempMonoInstrumentSampleBuffer[sampleIndex];
						tempMonoInstrumentSampleBuffer[sampleIndex] = 0.0;`
						
				if (usesDistortionEffect) {
					effectsSource += `
						
						sample *= amp; // + 0.5; // DC warmth?
						sample = distortionBaseVolume * sample / ((1.0 - distortion) * Math.abs(sample) + distortion);`
				}
				
				if (usesBitcrusherEffect) {
					effectsSource += `
						
						// TODO: optimize? How bad is the conditional branch here?
						bitcrusherPhase += bitcrusherPhaseDelta;
						bitcrusherPhaseDelta *= bitcrusherPhaseDeltaScale;
						bitcrusherScale += bitcrusherScaleDelta;
						if (bitcrusherPhase < 1.0) {
							sample = bitcrusherCurrentValue;
						} else {
							bitcrusherPhase = bitcrusherPhase % 1.0;
							const ratio = bitcrusherPhase / bitcrusherPhaseDelta;
							const scaledSample = sample * bitcrusherScale;
							const oldValue = bitcrusherCurrentValue;
							const newValue = (scaledSample + (scaledSample > 0 ? 0.5 : -.5)|0) / bitcrusherScale;
							sample = oldValue + (newValue - oldValue) * ratio;
							bitcrusherCurrentValue = newValue;
						}`
				}
						
				if (usesEffectFilter) {
					effectsSource += `
						
						const inputSample = sample;
						sample = synth.applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
						initialFilterInput2 = initialFilterInput1;
						initialFilterInput1 = inputSample;`
				}
				
				effectsSource += `
					
						sample *= volume;
						volume += volumeDelta;`
				
				if (usesPanningEffect) {
					effectsSource += `
					
						const panningRatioL  = panningOffsetL % 1;
						const panningRatioR  = panningOffsetR % 1;
						const panningTapLA   = panningDelayLine[(panningOffsetL) & panningMask];
						const panningTapLB   = panningDelayLine[(panningOffsetL + 1) & panningMask];
						const panningTapRA   = panningDelayLine[(panningOffsetR) & panningMask];
						const panningTapRB   = panningDelayLine[(panningOffsetR + 1) & panningMask];
						const panningTapL    = panningTapLA + (panningTapLB - panningTapLA) * panningRatioL;
						const panningTapR    = panningTapRA + (panningTapRB - panningTapRA) * panningRatioR;
						let sampleL = panningTapL * panningVolumeL;
						let sampleR = panningTapR * panningVolumeR;
						panningDelayLine[panningDelayPos] = sample;
						panningDelayPos = (panningDelayPos + 1) & panningMask;
						panningVolumeL += panningVolumeDeltaL;
						panningVolumeR += panningVolumeDeltaR;
						panningOffsetL += panningOffsetDeltaL;
						panningOffsetR += panningOffsetDeltaR;`
				} else {
					effectsSource += `
					
						let sampleL = sample;
						let sampleR = sample;`
				}
					
				if (usesChorusEffect) {
					effectsSource += `
					
						const chorusTap0Ratio = chorusTap0Index % 1;
						const chorusTap1Ratio = chorusTap1Index % 1;
						const chorusTap2Ratio = chorusTap2Index % 1;
						const chorusTap3Ratio = chorusTap3Index % 1;
						const chorusTap4Ratio = chorusTap4Index % 1;
						const chorusTap5Ratio = chorusTap5Index % 1;
						const chorusTap0A = chorusDelayLineL[(chorusTap0Index) & chorusMask];
						const chorusTap0B = chorusDelayLineL[(chorusTap0Index + 1) & chorusMask];
						const chorusTap1A = chorusDelayLineL[(chorusTap1Index) & chorusMask];
						const chorusTap1B = chorusDelayLineL[(chorusTap1Index + 1) & chorusMask];
						const chorusTap2A = chorusDelayLineL[(chorusTap2Index) & chorusMask];
						const chorusTap2B = chorusDelayLineL[(chorusTap2Index + 1) & chorusMask];
						const chorusTap3A = chorusDelayLineR[(chorusTap3Index) & chorusMask];
						const chorusTap3B = chorusDelayLineR[(chorusTap3Index + 1) & chorusMask];
						const chorusTap4A = chorusDelayLineR[(chorusTap4Index) & chorusMask];
						const chorusTap4B = chorusDelayLineR[(chorusTap4Index + 1) & chorusMask];
						const chorusTap5A = chorusDelayLineR[(chorusTap5Index) & chorusMask];
						const chorusTap5B = chorusDelayLineR[(chorusTap5Index + 1) & chorusMask];
						const chorusTap0 = chorusTap0A + (chorusTap0B - chorusTap0A) * chorusTap0Ratio;
						const chorusTap1 = chorusTap1A + (chorusTap1B - chorusTap1A) * chorusTap1Ratio;
						const chorusTap2 = chorusTap2A + (chorusTap2B - chorusTap2A) * chorusTap2Ratio;
						const chorusTap3 = chorusTap3A + (chorusTap3B - chorusTap3A) * chorusTap3Ratio;
						const chorusTap4 = chorusTap4A + (chorusTap4B - chorusTap4A) * chorusTap4Ratio;
						const chorusTap5 = chorusTap5A + (chorusTap5B - chorusTap5A) * chorusTap5Ratio;
						chorusDelayLineL[chorusDelayPos] = sampleL * delayInputMult;
						chorusDelayLineR[chorusDelayPos] = sampleR * delayInputMult;
						sampleL = 0.5 * (sampleL - chorusTap0 + chorusTap1 - chorusTap2);
						sampleR = 0.5 * (sampleR - chorusTap3 + chorusTap4 - chorusTap5);
						chorusDelayPos = (chorusDelayPos + 1) & chorusMask;
						chorusTap0Index += chorusTap0Delta;
						chorusTap1Index += chorusTap1Delta;
						chorusTap2Index += chorusTap2Delta;
						chorusTap3Index += chorusTap3Delta;
						chorusTap4Index += chorusTap4Delta;
						chorusTap5Index += chorusTap5Delta;`
				}
					
				if (usesReverbEffect) {
					effectsSource += `
					
						// Reverb, implemented using a feedback delay network with a Hadamard matrix and lowpass filters.
						// good ratios:    0.555235 + 0.618033 + 0.818 +   1.0 = 2.991268
						// Delay lengths:  3041     + 3385     + 4481  +  5477 = 16384 = 2^14
						// Buffer offsets: 3041    -> 6426   -> 10907 -> 16384
						const reverbDelayPos1 = (reverbDelayPos +  3041) & reverbMask;
						const reverbDelayPos2 = (reverbDelayPos +  6426) & reverbMask;
						const reverbDelayPos3 = (reverbDelayPos + 10907) & reverbMask;
						const reverbSample0 = (reverbDelayLine[reverbDelayPos]);
						const reverbSample1 = reverbDelayLine[reverbDelayPos1];
						const reverbSample2 = reverbDelayLine[reverbDelayPos2];
						const reverbSample3 = reverbDelayLine[reverbDelayPos3];
						const reverbTemp0 = -(reverbSample0 + sampleL) + reverbSample1;
						const reverbTemp1 = -(reverbSample0 + sampleR) - reverbSample1;
						const reverbTemp2 = -reverbSample2 + reverbSample3;
						const reverbTemp3 = -reverbSample2 - reverbSample3;
						reverbFeedback0 += ((reverbTemp0 + reverbTemp2) * reverb - reverbFeedback0) * 0.5;
						reverbFeedback1 += ((reverbTemp1 + reverbTemp3) * reverb - reverbFeedback1) * 0.5;
						reverbFeedback2 += ((reverbTemp0 - reverbTemp2) * reverb - reverbFeedback2) * 0.5;
						reverbFeedback3 += ((reverbTemp1 - reverbTemp3) * reverb - reverbFeedback3) * 0.5;
						reverbDelayLine[reverbDelayPos1] = reverbFeedback0 * delayInputMult;
						reverbDelayLine[reverbDelayPos2] = reverbFeedback1 * delayInputMult;
						reverbDelayLine[reverbDelayPos3] = reverbFeedback2 * delayInputMult;
						reverbDelayLine[reverbDelayPos ] = reverbFeedback3 * delayInputMult;
						reverbDelayPos = (reverbDelayPos + 1) & reverbMask;
						sampleL += reverbSample1 + reverbSample2 + reverbSample3;
						sampleR += reverbSample0 + reverbSample2 - reverbSample3;`
				}
				
				effectsSource += `
						
						outputDataL[sampleIndex] += sampleL;
						outputDataR[sampleIndex] += sampleR;`
						
				if (usesDelayEffects) {
					effectsSource += `
					
						delayInputMult += delayInputMultDelta;`
				}
				
				effectsSource += `
					}
					
					// Avoid persistent denormal or NaN values in the delay buffers and filter history.
					const epsilon = (1.0e-24);`
				
				if (usesBitcrusherEffect) {
					effectsSource += `
						
						instrumentState.bitcrusherCurrentValue = bitcrusherCurrentValue;
						instrumentState.bitcrusherPhase = bitcrusherPhase;`
				}
					
				if (usesEffectFilter) {
					effectsSource += `
						
					synth.sanitizeFilters(filters);
					// The filter input here is downstream from another filter so we
					// better make sure it's safe too.
					if (!(initialFilterInput1 < 100) || !(initialFilterInput2 < 100)) {
						initialFilterInput1 = 0.0;
						initialFilterInput2 = 0.0;
					}
					if (Math.abs(initialFilterInput1) < epsilon) initialFilterInput1 = 0.0;
					if (Math.abs(initialFilterInput2) < epsilon) initialFilterInput2 = 0.0;
					instrumentState.initialDistortionFilterInput1 = initialFilterInput1;
					instrumentState.initialDistortionFilterInput2 = initialFilterInput2;`
				}
				
				if (usesPanningEffect) {
					effectsSource += `
					
					beepbox.Synth.sanitizeDelayLine(panningDelayLine, panningDelayPos, panningMask);
					instrumentState.panningDelayPos = panningDelayPos;`
				}
					
				if (usesChorusEffect) {
					effectsSource += `
					
					beepbox.Synth.sanitizeDelayLine(chorusDelayLineL, chorusDelayPos, chorusMask);
					beepbox.Synth.sanitizeDelayLine(chorusDelayLineR, chorusDelayPos, chorusMask);
					instrumentState.chorusPhase = chorusPhase;
					instrumentState.chorusDelayPos = chorusDelayPos;`
				}
					
				if (usesReverbEffect) {
					effectsSource += `
					
					if (!Number.isFinite(reverbFeedback0) || Math.abs(reverbFeedback0) < epsilon) reverbFeedback0 = 0.0;
					if (!Number.isFinite(reverbFeedback1) || Math.abs(reverbFeedback1) < epsilon) reverbFeedback1 = 0.0;
					if (!Number.isFinite(reverbFeedback2) || Math.abs(reverbFeedback2) < epsilon) reverbFeedback2 = 0.0;
					if (!Number.isFinite(reverbFeedback3) || Math.abs(reverbFeedback3) < epsilon) reverbFeedback3 = 0.0;
					beepbox.Synth.sanitizeDelayLine(reverbDelayLine, reverbDelayPos        , reverbMask);
					beepbox.Synth.sanitizeDelayLine(reverbDelayLine, reverbDelayPos +  3041, reverbMask);
					beepbox.Synth.sanitizeDelayLine(reverbDelayLine, reverbDelayPos +  6426, reverbMask);
					beepbox.Synth.sanitizeDelayLine(reverbDelayLine, reverbDelayPos + 10907, reverbMask);
					instrumentState.reverbDelayPos  = reverbDelayPos;
					instrumentState.reverbFeedback0 = reverbFeedback0;
					instrumentState.reverbFeedback1 = reverbFeedback1;
					instrumentState.reverbFeedback2 = reverbFeedback2;
					instrumentState.reverbFeedback3 = reverbFeedback3;`
				}
				
				//console.log(effectsSource);
				effectsFunction = new Function("synth", "outputDataL", "outputDataR", "bufferIndex", "runLength", "instrument", "instrumentState", effectsSource);
				Synth.effectsFunctionCache[signature] = effectsFunction;
			}
			
			effectsFunction(synth, outputDataL, outputDataR, bufferIndex, runLength, instrument, instrumentState);
		}
		
		private static pulseWidthSynth(synth: Synth, bufferIndex: number, runLength: number, tone: Tone, instrument: Instrument): void {
			const data: Float32Array = synth.tempMonoInstrumentSampleBuffer!;
			
			let phaseDelta: number = tone.phaseDeltas[0];
			const phaseDeltaScale: number = +tone.phaseDeltaScale;
			let expression: number = +tone.expressionStarts[0];
			const expressionDelta: number = +tone.expressionDeltas[0];
			let phase: number = (tone.phases[0] % 1);
			
			let pulseWidth: number = tone.pulseWidth;
			const pulseWidthDelta: number = tone.pulseWidthDelta;
			
			const filters: DynamicBiquadFilter[] = tone.filters;
			const filterCount: number = tone.filterCount|0;
			let initialFilterInput1: number = +tone.initialFilterInput1;
			let initialFilterInput2: number = +tone.initialFilterInput2;
			
			const stopIndex: number = bufferIndex + runLength;
			for (let sampleIndex: number = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
				
				const sawPhaseA: number = phase % 1;
				const sawPhaseB: number = (phase + pulseWidth) % 1;
				
				let pulseWave: number = sawPhaseB - sawPhaseA;
				
				// This is a PolyBLEP, which smooths out discontinuities at any frequency to reduce aliasing. 
				if (sawPhaseA < phaseDelta) {
					var t = sawPhaseA / phaseDelta;
					pulseWave += (t+t-t*t-1) * 0.5;
				} else if (sawPhaseA > 1.0 - phaseDelta) {
					var t = (sawPhaseA - 1.0) / phaseDelta;
					pulseWave += (t+t+t*t+1) * 0.5;
				}
				if (sawPhaseB < phaseDelta) {
					var t = sawPhaseB / phaseDelta;
					pulseWave -= (t+t-t*t-1) * 0.5;
				} else if (sawPhaseB > 1.0 - phaseDelta) {
					var t = (sawPhaseB - 1.0) / phaseDelta;
					pulseWave -= (t+t+t*t+1) * 0.5;
				}
				
				const inputSample: number = pulseWave;
				const sample: number = synth.applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
				initialFilterInput2 = initialFilterInput1;
				initialFilterInput1 = inputSample;
				
				phase += phaseDelta;
				phaseDelta *= phaseDeltaScale;
				pulseWidth += pulseWidthDelta;
				
				const output: number = sample * expression;
				expression += expressionDelta;
				
				data[sampleIndex] += output;
			}
			
			tone.phases[0] = phase;
			
			synth.sanitizeFilters(filters);
			tone.initialFilterInput1 = initialFilterInput1;
			tone.initialFilterInput2 = initialFilterInput2;
		}
		
		private static fmSourceTemplate: string[] = (`
			const data = synth.tempMonoInstrumentSampleBuffer;
			const sineWave = beepbox.Config.sineWave;
			
			let phaseDeltaScale = +tone.phaseDeltaScale;
			// I'm adding 1000 to the phase to ensure that it's never negative even when modulated by other waves because negative numbers don't work with the modulus operator very well.
			let operator#Phase       = +((tone.phases[#] % 1) + 1000) * beepbox.Config.sineWaveLength;
			let operator#PhaseDelta  = +tone.phaseDeltas[#];
			let operator#OutputMult  = +tone.expressionStarts[#];
			const operator#OutputDelta = +tone.expressionDeltas[#];
			let operator#Output      = +tone.feedbackOutputs[#];
			let feedbackMult         = +tone.feedbackMult;
			const feedbackDelta      = +tone.feedbackDelta;
			
			const filters = tone.filters;
			const filterCount = tone.filterCount|0;
			let initialFilterInput1 = +tone.initialFilterInput1;
			let initialFilterInput2 = +tone.initialFilterInput2;
			
			const stopIndex = bufferIndex + runLength;
			for (let sampleIndex = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
				// INSERT OPERATOR COMPUTATION HERE
				const fmOutput = (/*operator#Scaled*/); // CARRIER OUTPUTS
				
				const inputSample = fmOutput;
				const sample = synth.applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
				initialFilterInput2 = initialFilterInput1;
				initialFilterInput1 = inputSample;
				
				feedbackMult += feedbackDelta;
				operator#OutputMult += operator#OutputDelta;
				operator#Phase += operator#PhaseDelta;
				operator#PhaseDelta *= phaseDeltaScale;
				
				data[sampleIndex] += sample;
			}
			
			tone.phases[#] = operator#Phase / ` + Config.sineWaveLength + `;
			tone.feedbackOutputs[#] = operator#Output;
			
			synth.sanitizeFilters(filters);
			tone.initialFilterInput1 = initialFilterInput1;
			tone.initialFilterInput2 = initialFilterInput2;
		`).split("\n");
		
		private static operatorSourceTemplate: string[] = (`
				const operator#PhaseMix = operator#Phase/* + operator@Scaled*/;
				const operator#PhaseInt = operator#PhaseMix|0;
				const operator#Index    = operator#PhaseInt & ` + Config.sineWaveMask + `;
				const operator#Sample   = sineWave[operator#Index];
				operator#Output         = operator#Sample + (sineWave[operator#Index + 1] - operator#Sample) * (operator#PhaseMix - operator#PhaseInt);
				const operator#Scaled   = operator#OutputMult * operator#Output;
		`).split("\n");
		
		private static noiseSynth(synth: Synth, bufferIndex: number, runLength: number, tone: Tone, instrument: Instrument): void {
			const data: Float32Array = synth.tempMonoInstrumentSampleBuffer!;
			let wave: Float32Array = instrument.getDrumWave();
			let phaseDelta: number = +tone.phaseDeltas[0];
			const phaseDeltaScale: number = +tone.phaseDeltaScale;
			let expression: number = +tone.expressionStarts[0];
			const expressionDelta: number = +tone.expressionDeltas[0];
			let phase: number = (tone.phases[0] % 1) * Config.chipNoiseLength;
			if (tone.phases[0] == 0) {
				// Zero phase means the tone was reset, just give noise a random start phase instead.
				phase = Math.random() * Config.chipNoiseLength;
			}
			const phaseMask: number = Config.chipNoiseLength - 1;
			let noiseSample: number = +tone.sample;
			
			const filters: DynamicBiquadFilter[] = tone.filters;
			const filterCount: number = tone.filterCount|0;
			let initialFilterInput1: number = +tone.initialFilterInput1;
			let initialFilterInput2: number = +tone.initialFilterInput2;
			
			// This is for a "legacy" style simplified 1st order lowpass filter with
			// a cutoff frequency that is relative to the tone's fundamental frequency.
			const pitchRelativefilter: number = Math.min(1.0, tone.phaseDeltas[0] * Config.chipNoises[instrument.chipNoise].pitchFilterMult);
			
			const stopIndex: number = bufferIndex + runLength;
			for (let sampleIndex: number = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
				const waveSample: number = wave[phase & phaseMask];
				
				noiseSample += (waveSample - noiseSample) * pitchRelativefilter;
				
				const inputSample: number = noiseSample;
				const sample: number = synth.applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
				initialFilterInput2 = initialFilterInput1;
				initialFilterInput1 = inputSample;
				
				phase += phaseDelta;
				phaseDelta *= phaseDeltaScale;
				
				const output: number = sample * expression;
				expression += expressionDelta;
				
				data[sampleIndex] += output;
			}
			
			tone.phases[0] = phase / Config.chipNoiseLength;
			tone.sample = noiseSample;
			
			synth.sanitizeFilters(filters);
			tone.initialFilterInput1 = initialFilterInput1;
			tone.initialFilterInput2 = initialFilterInput2;
		}
		
		private static spectrumSynth(synth: Synth, bufferIndex: number, runLength: number, tone: Tone, instrument: Instrument): void {
			const data: Float32Array = synth.tempMonoInstrumentSampleBuffer!;
			let wave: Float32Array = instrument.getDrumWave();
			let phaseDelta: number = tone.phaseDeltas[0] * (1 << 7);
			const phaseDeltaScale: number = +tone.phaseDeltaScale;
			let expression: number = +tone.expressionStarts[0];
			const expressionDelta: number = +tone.expressionDeltas[0];
			let noiseSample: number = +tone.sample;
			
			const filters: DynamicBiquadFilter[] = tone.filters;
			const filterCount: number = tone.filterCount|0;
			let initialFilterInput1: number = +tone.initialFilterInput1;
			let initialFilterInput2: number = +tone.initialFilterInput2;
			
			let phase: number = (tone.phases[0] % 1) * Config.spectrumNoiseLength;
			// Zero phase means the tone was reset, just give noise a random start phase instead.
			if (tone.phases[0] == 0) phase = Synth.findRandomZeroCrossing(wave, Config.spectrumNoiseLength) + phaseDelta;
			const phaseMask: number = Config.spectrumNoiseLength - 1;
			
			// This is for a "legacy" style simplified 1st order lowpass filter with
			// a cutoff frequency that is relative to the tone's fundamental frequency.
			const pitchRelativefilter: number = Math.min(1.0, phaseDelta);
			
			const stopIndex: number = bufferIndex + runLength;
			for (let sampleIndex: number = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
				const phaseInt: number = phase|0;
				const index: number = phaseInt & phaseMask;
				let waveSample: number = wave[index];
				const phaseRatio: number = phase - phaseInt;
				waveSample += (wave[index + 1] - waveSample) * phaseRatio;
				
				noiseSample += (waveSample - noiseSample) * pitchRelativefilter;
				
				const inputSample: number = noiseSample;
				const sample: number = synth.applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
				initialFilterInput2 = initialFilterInput1;
				initialFilterInput1 = inputSample;
			
				phase += phaseDelta;
				phaseDelta *= phaseDeltaScale;
				
				const output: number = sample * expression;
				expression += expressionDelta;
				
				data[sampleIndex] += output;
			}
			
			tone.phases[0] = phase / Config.spectrumNoiseLength;
			tone.sample = noiseSample;
			
			synth.sanitizeFilters(filters);
			tone.initialFilterInput1 = initialFilterInput1;
			tone.initialFilterInput2 = initialFilterInput2;
		}
		
		private static drumsetSynth(synth: Synth, bufferIndex: number, runLength: number, tone: Tone, instrument: Instrument): void {
			const data: Float32Array = synth.tempMonoInstrumentSampleBuffer!;
			let wave: Float32Array = instrument.getDrumsetWave(tone.drumsetPitch);
			let phaseDelta: number = tone.phaseDeltas[0] / Instrument.drumsetIndexReferenceDelta(tone.drumsetPitch);;
			const phaseDeltaScale: number = +tone.phaseDeltaScale;
			let expression: number = +tone.expressionStarts[0];
			const expressionDelta: number = +tone.expressionDeltas[0];
			
			const filters: DynamicBiquadFilter[] = tone.filters;
			const filterCount: number = tone.filterCount|0;
			let initialFilterInput1: number = +tone.initialFilterInput1;
			let initialFilterInput2: number = +tone.initialFilterInput2;
			
			let phase: number = (tone.phases[0] % 1) * Config.spectrumNoiseLength;
			// Zero phase means the tone was reset, just give noise a random start phase instead.
			if (tone.phases[0] == 0) phase = Synth.findRandomZeroCrossing(wave, Config.spectrumNoiseLength) + phaseDelta;
			const phaseMask: number = Config.spectrumNoiseLength - 1;
			
			const stopIndex: number = bufferIndex + runLength;
			for (let sampleIndex: number = bufferIndex; sampleIndex < stopIndex; sampleIndex++) {
				const phaseInt: number = phase|0;
				const index: number = phaseInt & phaseMask;
				let noiseSample: number = wave[index];
				const phaseRatio: number = phase - phaseInt;
				noiseSample += (wave[index + 1] - noiseSample) * phaseRatio;
				
				const inputSample: number = noiseSample;
				const sample: number = synth.applyFilters(inputSample, initialFilterInput1, initialFilterInput2, filterCount, filters);
				initialFilterInput2 = initialFilterInput1;
				initialFilterInput1 = inputSample;
			
				phase += phaseDelta;
				phaseDelta *= phaseDeltaScale;
				
				const output: number = sample * expression;
				expression += expressionDelta;
				
				data[sampleIndex] += output;
			}
			
			tone.phases[0] = phase / Config.spectrumNoiseLength;
			
			synth.sanitizeFilters(filters);
			tone.initialFilterInput1 = initialFilterInput1;
			tone.initialFilterInput2 = initialFilterInput2;
		}
		
		private static findRandomZeroCrossing(wave: Float32Array, waveLength: number): number {
			let phase: number = Math.random() * waveLength;
			const phaseMask: number = waveLength - 1;
			
			// Spectrum and drumset waves sounds best when they start at a zero crossing,
			// otherwise they pop. Try to find a zero crossing.
			let indexPrev: number = phase & phaseMask;
			let wavePrev: number = wave[indexPrev];
			const stride: number = 16;
			for (let attemptsRemaining: number = 128; attemptsRemaining > 0; attemptsRemaining--) {
				const indexNext: number = (indexPrev + stride) & phaseMask;
				const waveNext: number = wave[indexNext];
				if (wavePrev * waveNext <= 0.0) {
					// Found a zero crossing! Now let's narrow it down to two adjacent sample indices.
					for (let i: number = 0; i < stride; i++) {
						const innerIndexNext: number = (indexPrev + 1) & phaseMask;
						const innerWaveNext: number = wave[innerIndexNext];
						if (wavePrev * innerWaveNext <= 0.0) {
							// Found the zero crossing again! Now let's find the exact intersection.
							const slope: number = innerWaveNext - wavePrev;
							phase = indexPrev;
							if (Math.abs(slope) > 0.00000001) {
								phase += -wavePrev / slope;
							}
							phase = Math.max(0, phase) % waveLength;
							break;
						} else {
							indexPrev = innerIndexNext;
							wavePrev = innerWaveNext;
						}
					}
					break;
				} else {
					indexPrev = indexNext;
					wavePrev = waveNext;
				}
			}
			
			return phase;
		}
		
		public static instrumentVolumeToVolumeMult(instrumentVolume: number): number {
			return (instrumentVolume == Config.volumeRange - 1) ? 0.0 : Math.pow(2, Config.volumeLogScale * instrumentVolume);
		}
		public static volumeMultToInstrumentVolume(volumeMult: number): number {
			return (volumeMult <= 0.0) ? Config.volumeRange - 1 : Math.min(Config.volumeRange - 2, Math.log2(volumeMult) / Config.volumeLogScale);
		}
		public static expressionToVolumeMult(expression: number): number {
			return Math.pow(Math.max(0.0, expression) / 3.0, 1.5);
		}
		public static volumeMultToExpression(volumeMult: number): number {
			return Math.pow(Math.max(0.0, volumeMult), 1/1.5) * 3.0;
		}
		
		private getSamplesPerTick(): number {
			if (this.song == null) return 0;
			const beatsPerMinute: number = this.song.getBeatsPerMinute();
			const beatsPerSecond: number = beatsPerMinute / 60.0;
			const partsPerSecond: number = Config.partsPerBeat * beatsPerSecond;
			const tickPerSecond: number = Config.ticksPerPart * partsPerSecond;
			return this.samplesPerSecond / tickPerSecond;
		}
		
		private static fittingPowerOfTwo(x: number): number {
			return 1 << (32 - Math.clz32(Math.ceil(x) - 1));
		}
		
		private sanitizeFilters(filters: DynamicBiquadFilter[]): void {
			let reset: boolean = false;
			for (const filter of filters) {
				const output1: number = Math.abs(filter.output1);
				const output2: number = Math.abs(filter.output2);
				// If either is a large value, Infinity, or NaN, then just reset all filter history.
				if (!(output1 < 100) || !(output2 < 100)) {
					reset = true;
					break;
				}
				if (output1 < epsilon) filter.output1 = 0.0;
				if (output2 < epsilon) filter.output2 = 0.0;
			}
			if (reset) {
				for (const filter of filters) {
					filter.output1 = 0.0;
					filter.output2 = 0.0;
				}
			}
		}
		
		public static sanitizeDelayLine(delayLine: Float32Array, lastIndex: number, mask: number): void {
			while (true) {
				lastIndex--;
				const index: number = lastIndex & mask;
				const sample: number = Math.abs(delayLine[index]);
				if (Number.isFinite(sample) && (sample == 0.0 || sample >= epsilon)) break;
				delayLine[index] = 0.0;
			}
		}
		
		private applyFilters(sample: number, input1: number, input2: number, filterCount: number, filters: DynamicBiquadFilter[]): number {
			for (let i: number = 0; i < filterCount; i++) {
				const filter: DynamicBiquadFilter = filters[i];
				const output1: number = filter.output1;
				const output2: number = filter.output2;
				const a1: number = filter.a1;
				const a2: number = filter.a2;
				const b0: number = filter.b0;
				const b1: number = filter.b1;
				const b2: number = filter.b2;
				sample = b0 * sample + b1 * input1 + b2 * input2 - a1 * output1 - a2 * output2;
				filter.a1 = a1 + filter.a1Delta;
				filter.a2 = a2 + filter.a2Delta;
				filter.b0 = b0 + filter.b0Delta;
				filter.b1 = b1 + filter.b1Delta;
				filter.b2 = b2 + filter.b2Delta;
				filter.output2 = output1;
				filter.output1 = sample;
				// Updating the input values is waste if the next filter doesn't exist...
				input2 = output2;
				input1 = output1;
			}
			return sample;
		}
	}

	// When compiling synth.ts as a standalone module named "beepbox", expose these imported classes as members to JavaScript:
	export {Dictionary, DictionaryArray, FilterType, EnvelopeType, InstrumentType, Transition, Chord, Envelope, Config};
//}
