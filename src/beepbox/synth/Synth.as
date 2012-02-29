package beepbox.synth {
	
	import flash.events.SampleDataEvent;
	import flash.events.TimerEvent;
	import flash.media.Sound;
	import flash.media.SoundChannel;
	import flash.utils.Timer;
	import flash.utils.ByteArray;
	
	public class Synth {
		public const samplesPerSecond: int = 44100;
		
		public var song: Song = null;
		public var pianoPressed: Boolean = false;
		public var pianoNote: int = 0;
		public var pianoChannel: int = 0;
		
		private var _playhead: Number = 0.0;
		private var bar: int = 0;
		private var beat: int = 0;
		private var part: int = 0;
		private var arpeggio: int = 0;
		private var arpeggioSamples: int = 0;
		private var paused: Boolean = true;
		private const waves: Vector.<Vector.<Number>> = new <Vector.<Number>> [
			new <Number>[1.0/15.0, 3.0/15.0, 5.0/15.0, 7.0/15.0, 9.0/15.0, 11.0/15.0, 13.0/15.0, 15.0/15.0, 15.0/15.0, 13.0/15.0, 11.0/15.0, 9.0/15.0, 7.0/15.0, 5.0/15.0, 3.0/15.0, 1.0/15.0, -1.0/15.0, -3.0/15.0, -5.0/15.0, -7.0/15.0, -9.0/15.0, -11.0/15.0, -13.0/15.0, -15.0/15.0, -15.0/15.0, -13.0/15.0, -11.0/15.0, -9.0/15.0, -7.0/15.0, -5.0/15.0, -3.0/15.0, -1.0/15.0],
			new <Number>[1.0, -1.0],
			new <Number>[1.0, -1.0, -1.0, -1.0],
			new <Number>[1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0],
			new <Number>[1.0/31.0, 3.0/31.0, 5.0/31.0, 7.0/31.0, 9.0/31.0, 11.0/31.0, 13.0/31.0, 15.0/31.0, 17.0/31.0, 19.0/31.0, 21.0/31.0, 23.0/31.0, 25.0/31.0, 27.0/31.0, 29.0/31.0, 31.0/31.0, -31.0/31.0, -29.0/31.0, -27.0/31.0, -25.0/31.0, -23.0/31.0, -21.0/31.0, -19.0/31.0, -17.0/31.0, -15.0/31.0, -13.0/31.0, -11.0/31.0, -9.0/31.0, -7.0/31.0, -5.0/31.0, -3.0/31.0, -1.0/31.0],
			new <Number>[0.0, -0.2, -0.4, -0.6, -0.8, -1.0, 1.0, -0.8, -0.6, -0.4, -0.2, 1.0, 0.8, 0.6, 0.4, 0.2, ],
			new <Number>[1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0],
			new <Number>[1.0, -1.0, 1.0, -1.0, 1.0, 0.0],
			new <Number>[0.0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.2, 0.0, -0.2, -0.4, -0.5, -0.6, -0.7, -0.8, -0.85, -0.9, -0.95, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -0.95, -0.9, -0.85, -0.8, -0.7, -0.6, -0.5, -0.4, -0.2, ],
		];
		private var leadPeriod: Number = 0.0;
		private var leadPrevSample: Number = 0.0;
		private var harmonyPeriod: Number = 0.0;
		private var harmonyPrevSample: Number = 0.0;
		private var bassPeriod: Number = 0.0;
		private var bassPrevSample: Number = 0.0;
		private var drumPeriod: Number = 0.0;
		private var drumPrevSample: Number = 0.0;
		private var drumBuffer: int = 1;
		private var stillGoing: Boolean = false;
		private var sound: Sound = new Sound();
		private var soundChannel: SoundChannel = null;
		private var timer: Timer = new Timer(200, 0);
		
		public function get playing(): Boolean {
			return !paused;
		}
		
		public function get playhead(): Number {
			return _playhead;
		}
		
		public function get totalSamples(): int {
			if (song == null) return 0;
			return getSamplesPerArpeggio() * 4 * song.parts * song.beats * Music.numBars;
		}
		
		public function get totalSeconds(): Number {
			return totalSamples / samplesPerSecond;
		}
		
		public function get totalBars(): Number {
			return Music.numBars;
		}
		
		public function Synth(song: * = null) {
			waves.fixed = true;
			for each (var wave: Vector.<Number> in waves) {
				wave.fixed = true;
			}
			
			sound.addEventListener(SampleDataEvent.SAMPLE_DATA, onSampleData, false, 0, true);
			timer.addEventListener(TimerEvent.TIMER, checkSound);
			
			if (song != null) {
				setSong(song);
			}
		}
		
		public function setSong(song: *): void {
			if (song is String) {
				this.song = new Song(song);
			} else if (song is Song) {
				this.song = song;
			}
		}
		
		public function play(): void {
			if (!paused) return;
			paused = false;
			soundChannel = sound.play();
			timer.start();
			stillGoing = true;
		}
		
		public function pause(): void {
			if (paused) return;
			paused = true;
			soundChannel.stop();
			soundChannel = null;
			timer.stop();
			stillGoing = false;
		}
		
		public function snapToStart(): void {
			bar = song == null ? 0 : song.loopStart;
			snapToBar();
		}
		
		public function snapToBar(): void {
			_playhead = bar;
			beat = 0;
			part = 0;
			arpeggio = 0;
			arpeggioSamples = 0;
		}
		
		public function nextBar(): void {
			bar++;
			if (bar == Music.numBars) bar = 0;
			if (song != null) {
				if (bar < song.loopStart || bar >= song.loopStart + song.loopLength) bar = song.loopStart;
			}
		}
		
		public function prevBar(): void {
			bar--;
			if (bar < 0) bar = Music.numBars - 1;
			if (song != null) {
				if (bar < song.loopStart || bar >= song.loopStart + song.loopLength) bar = song.loopStart;
			}
		}
		
		private function onSampleData(event: SampleDataEvent): void {
			if (paused) {
				return;
			} else {
				synthesize(event.data, 4096, true);
			}
			stillGoing = true;
		}
		
		private function checkSound(event: TimerEvent): void {
			if (!stillGoing) {
				if (soundChannel != null) {
					soundChannel.stop();
				}
				soundChannel = sound.play();
			} else {
				stillGoing = false;
			}
		}
		
		public function synthesize(data: ByteArray, totalSamples: int, loop: Boolean): void {
			var i: int;
			
			if (song == null) {
				for (i = 0; i < totalSamples; i++) {
					data.writeFloat(0.0);
					data.writeFloat(0.0);
				}
				return;
			}
			
			const sampleTime: Number = 1.0 / samplesPerSecond;
			const samplesPerArpeggio: int = getSamplesPerArpeggio();
			
			const maxLeadVolume:    Number = Music.channelVolumes[0] * Music.waveVolumes[song.channelWaves[0]];
			const maxHarmonyVolume: Number = Music.channelVolumes[1] * Music.waveVolumes[song.channelWaves[1]];
			const maxBassVolume:    Number = Music.channelVolumes[2] * Music.waveVolumes[song.channelWaves[2]];
			const maxDrumVolume:    Number = Music.channelVolumes[3];
			
			const leadWave: Vector.<Number> = waves[song.channelWaves[0]];
			const harmonyWave: Vector.<Number> = waves[song.channelWaves[1]];
			const bassWave: Vector.<Number> = waves[song.channelWaves[2]];
			
			const leadWaveLength: int = leadWave.length;
			const harmonyWaveLength: int = harmonyWave.length;
			const bassWaveLength: int = bassWave.length;
			
			const leadFilterBase: Number = Math.pow(2, -Music.filterBases[song.channelFilters[0]]);
			const harmonyFilterBase: Number = Math.pow(2, -Music.filterBases[song.channelFilters[1]]);
			const bassFilterBase: Number = Math.pow(2, -Music.filterBases[song.channelFilters[2]]);
			const drumFilter: Number = 0.2;
			
			const leadFilterScale: Number = Math.pow(2, -Music.filterDecays[song.channelFilters[0]] / samplesPerSecond);
			const harmonyFilterScale: Number = Math.pow(2, -Music.filterDecays[song.channelFilters[1]] / samplesPerSecond);
			const bassFilterScale: Number = Math.pow(2, -Music.filterDecays[song.channelFilters[2]] / samplesPerSecond);
			
			//pow( self->channels[i].lowPassScale, time )
			
			if (arpeggioSamples == 0 || arpeggioSamples > samplesPerArpeggio) {
				arpeggioSamples = samplesPerArpeggio;
			}
			if (part >= song.parts) {
				beat++;
				part = 0;
				arpeggio = 0;
				arpeggioSamples = samplesPerArpeggio;
			}
			if (beat >= song.beats) {
				bar++;
				if (loop && (bar < song.loopStart || bar >= song.loopStart + song.loopLength)) {
					bar = song.loopStart;
				}
				beat = 0;
				part = 0;
				arpeggio = 0;
				arpeggioSamples = samplesPerArpeggio;
			}
			
			while (totalSamples > 0) {
				var samples: int;
				if (arpeggioSamples <= totalSamples) {
					samples = arpeggioSamples;
				} else {
					samples = totalSamples;
				}
				totalSamples -= samples;
				arpeggioSamples -= samples;
				
				var leadPeriodDelta: Number;
				var leadPeriodDeltaScale: Number;
				var leadVolume: Number;
				var leadVolumeDelta: Number;
				var leadFilter: Number;
				var harmonyPeriodDelta: Number;
				var harmonyPeriodDeltaScale: Number;
				var harmonyVolume: Number;
				var harmonyVolumeDelta: Number;
				var harmonyFilter: Number;
				var bassPeriodDelta: Number;
				var bassPeriodDeltaScale: Number;
				var bassVolume: Number;
				var bassVolumeDelta: Number;
				var bassFilter: Number;
				var drumPeriodDelta: Number;
				var drumPeriodDeltaScale: Number;
				var drumVolume: Number;
				var drumVolumeDelta: Number;
				var time: int = part + beat * song.parts;
				
				for (var channel: int = 0; channel < 4; channel++) {
					var pattern: BarPattern = song.getBarPattern(channel, bar);
					var tone: Tone = null;
					for (i = 0; i < pattern.tones.length; i++) {
						if (pattern.tones[i].end <= time) {
							continue;
						} else if (pattern.tones[i].start <= time && pattern.tones[i].end > time) {
							tone = pattern.tones[i];
							break;
						} else if (pattern.tones[i].start > time) {
							break;
						}
					}
					
					var channelRoot: int = Music.channelRoots[channel];
					var pitch: int = channel == 3 ? 0 : Music.keyTransposes[song.key];
					var intervalScale: int = channel == 3 ? Music.drumInterval : 1;
					var periodDelta: Number;
					var periodDeltaScale: Number;
					var volume: Number;
					var volumeDelta: Number;
					var filter: Number;
					var filterScale: Number;
					if (pianoPressed && channel == pianoChannel) {
						periodDelta = frequencyFromPitch(pitch + channelRoot + pianoNote * intervalScale) * sampleTime;
						periodDeltaScale = 1.0;
						volume = channel == 3 ? 1.0 : Math.pow(2.0, -(pitch + pianoNote) / 48.0);
						volumeDelta = 0.0;
						filter = 1.0;
					} else if (tone == null) {
						periodDelta = 0.0;
						periodDeltaScale = 0.0;
						volume = 0.0;
						volumeDelta = 0.0;
						filter = 1.0;
					} else {
						if (tone.notes.length == 2) {
							pitch += tone.notes[arpeggio >> 1];
						} else if (tone.notes.length == 3) {
							pitch += tone.notes[arpeggio == 3 ? 1 : arpeggio];
						} else if (tone.notes.length == 4) {
							pitch += tone.notes[arpeggio];
						} else {
							pitch += tone.notes[0];
						}
						pitch *= intervalScale;
						
						var startPin: TonePin = null;
						var endPin: TonePin = null;
						for each (var pin: TonePin in tone.pins) {
							if (pin.time + tone.start <= time) {
								startPin = pin;
							} else {
								endPin = pin;
								break;
							}
						}
						var startTime:     int = (tone.start + startPin.time - time) * 4 - arpeggio;
						var endTime:       int = (tone.start + endPin.time - time) * 4 - arpeggio;
						var startRatio:    Number = (1.0 - (arpeggioSamples + samples) / samplesPerArpeggio - startTime) / (endTime - startTime);
						var endRatio:      Number = (1.0 - (arpeggioSamples) / samplesPerArpeggio - startTime) / (endTime - startTime);
						var startInterval: Number = startPin.interval * (1.0 - startRatio) + endPin.interval * startRatio;
						var endInterval:   Number = startPin.interval * (1.0 - endRatio  ) + endPin.interval * endRatio;
						var startFreq: Number = frequencyFromPitch(pitch + channelRoot + startInterval);
						var endFreq:   Number = frequencyFromPitch(pitch + channelRoot + endInterval);
						var startVol:  Number = channel == 3 ? 1.0 : Math.pow(2.0, -(pitch + startInterval) / 48.0);
						var endVol:    Number = channel == 3 ? 1.0 : Math.pow(2.0, -(pitch + endInterval) / 48.0);
						startVol *= volumeConversion(startPin.volume * (1.0 - startRatio) + endPin.volume * startRatio);
						endVol   *= volumeConversion(startPin.volume * (1.0 - endRatio)   + endPin.volume * endRatio);
						var frequency: Number = startFreq;
						var freqScale: Number = endFreq / startFreq;
						periodDelta = frequency * sampleTime;
						periodDeltaScale = Math.pow(freqScale, 1.0 / samples);
						volume = startVol;
						volumeDelta = (endVol - startVol) / samples;
						
						var timeSinceStart: Number = (((time - tone.start) * 4.0 + arpeggio + 1.0) * samplesPerArpeggio - arpeggioSamples) / samplesPerSecond;
						filter = channel == 3 ? 1.0 : Math.pow(2, -Music.filterDecays[song.channelFilters[channel]] * timeSinceStart);
					}
					
					if (channel == 0) {
						leadPeriodDelta = periodDelta;
						leadPeriodDeltaScale = periodDeltaScale;
						leadVolume = volume * maxLeadVolume;
						leadVolumeDelta = volumeDelta * maxLeadVolume;
						leadFilter = filter * leadFilterBase;
						if (leadVolume == 0.0) leadPeriod = 0.0;
					} else if (channel == 1) {
						harmonyPeriodDelta = periodDelta;
						harmonyPeriodDeltaScale = periodDeltaScale;
						harmonyVolume = volume * maxHarmonyVolume;
						harmonyVolumeDelta = volumeDelta * maxHarmonyVolume;
						harmonyFilter = filter * harmonyFilterBase;
						if (harmonyVolume == 0.0) harmonyPeriod = 0.0;
					} else if (channel == 2) {
						bassPeriodDelta = periodDelta;
						bassPeriodDeltaScale = periodDeltaScale;
						bassVolume = volume * maxBassVolume;
						bassVolumeDelta = volumeDelta * maxBassVolume;
						bassFilter = filter * bassFilterBase;
						if (bassVolume == 0.0) bassPeriod = 0.0;
					} else if (channel == 3) {
						drumPeriodDelta = periodDelta;
						drumPeriodDeltaScale = periodDeltaScale;
						drumVolume = volume * maxDrumVolume;
						drumVolumeDelta = volumeDelta * maxDrumVolume;
						if (drumVolume == 0.0) drumPeriod = 0.0;
					}
				}
				
				while (samples > 0) {
					var sample: Number = 0.0;
					
					leadPrevSample += (leadWave[int(leadPeriod * leadWaveLength)] * leadVolume - leadPrevSample) * leadFilter;
					leadVolume += leadVolumeDelta;
					leadPeriod += leadPeriodDelta;
					leadPeriodDelta *= leadPeriodDeltaScale;
					leadPeriod -= int(leadPeriod);
					leadFilter *= leadFilterScale;
					sample += leadPrevSample;
					
					harmonyPrevSample += (harmonyWave[int(harmonyPeriod * harmonyWaveLength)] * harmonyVolume - harmonyPrevSample) * harmonyFilter;
					harmonyVolume += harmonyVolumeDelta;
					harmonyPeriod += harmonyPeriodDelta;
					harmonyPeriodDelta *= harmonyPeriodDeltaScale;
					harmonyPeriod -= int(harmonyPeriod);
					harmonyFilter *= harmonyFilterScale;
					sample += harmonyPrevSample;
					
					bassPrevSample += (bassWave[int(bassPeriod * bassWaveLength)] * bassVolume - bassPrevSample) * bassFilter;
					bassVolume += bassVolumeDelta;
					bassPeriod += bassPeriodDelta;
					bassPeriodDelta *= bassPeriodDeltaScale;
					bassPeriod -= int(bassPeriod);
					bassFilter *= bassFilterScale;
					sample += bassPrevSample;
					
					drumPrevSample += ((2.0 * (drumBuffer & 1) - 1.0) * drumVolume - drumPrevSample) * drumFilter;
					drumVolume += drumVolumeDelta;
					drumPeriod += drumPeriodDelta;
					drumPeriodDelta *= drumPeriodDeltaScale;
					if (drumPeriod >= 1.0) {
						drumPeriod -= 1.0;
						var newBuffer: int = drumBuffer >> 1;
						if ((drumBuffer + newBuffer) & 1 == 1) {
							newBuffer += 1 << 14;
						}
						drumBuffer = newBuffer;
					}
					sample += drumPrevSample;
					
					data.writeFloat(sample);
					data.writeFloat(sample);
					samples--;
				}
					
				if (arpeggioSamples == 0) {
					arpeggio++;
					arpeggioSamples = samplesPerArpeggio;
					if (arpeggio == 4) {
						arpeggio = 0;
						part++;
						if (part == song.parts) {
							part = 0;
							beat++;
							if (beat == song.beats) {
								beat = 0;
								bar++;
								if (loop && (bar < song.loopStart || bar >= song.loopStart + song.loopLength)) {
									bar = song.loopStart;
								}
							}
						}
					}
				}
			}
			
			_playhead = (((arpeggio + 1.0 - arpeggioSamples / samplesPerArpeggio) / 4.0 + part) / song.parts + beat) / song.beats + bar;
		}
		
		private function frequencyFromPitch(pitch: int): Number {
			return 440.0 * Math.pow(2.0, (pitch - 69.0) / 12.0);
		}
		
		private function volumeConversion(volume: Number): Number {
			return Math.pow(volume / 3.0, 1.5);
		}
		
		private function getSamplesPerArpeggio(): int {
			if (song == null) return 0;
			var beatsPerMinute: Number = 120.0 * Math.pow(2.0, (-1.0 + song.tempo) / 3.0);
			var beatsPerSecond: Number = beatsPerMinute / 60.0;
			var partsPerSecond: Number = beatsPerSecond * song.parts;
			var arpeggioPerSecond: Number = partsPerSecond * 4.0;
			return samplesPerSecond / arpeggioPerSecond;
		}
	}
}