# ChordMaster - MIDI Chord Game

ChordMaster is an interactive web-based game that helps you practice identifying and playing major and minor triads on your MIDI keyboard. The game displays random chord symbols, and you need to play the corresponding chord on your MIDI keyboard to earn points. It features a voice leading bonus system that rewards smooth transitions between chords.

## Features

- Real-time MIDI input detection
- Major and minor triad chord recognition
- Score based on accuracy and speed
- Visual feedback with different colors for major and minor chords
- Timer to track your response time
- Voice leading bonus system with multipliers
- Animated score calculations with fire effects
- Persistent leaderboard to track high scores
- Chord randomization that avoids repetition

## How to Play

1. Connect your MIDI keyboard to your computer
2. Open the `index.html` file in a compatible web browser (Chrome or Edge recommended)
3. Press the "Start Game" button once your MIDI device is detected
4. A chord symbol will appear (e.g., "C" for C major or "Dm" for D minor)
5. Play the corresponding chord on your MIDI keyboard
6. If correct, you'll earn points based on how quickly you played the chord
7. Press "Next Chord" to continue with a new chord

## Score Calculation

- Base score: 100 points per chord
- Time penalty: -10 points for each second taken
- Minimum score per chord: 10 points

## Requirements

- A modern web browser with WebMIDI support (Chrome, Edge recommended)
- A MIDI keyboard or controller connected to your computer
- Proper MIDI drivers installed for your device

## Future Enhancements

- Support for more complex chord types (7th, diminished, augmented, etc.)
- Difficulty levels
- Sound playback for reference
- Statistics tracking
- Chord progression mode

## Troubleshooting

If your MIDI device is not being detected:

1. Make sure your MIDI device is properly connected and powered on
2. Check that you have the correct drivers installed
3. Try refreshing the page
4. Some browsers may require you to explicitly grant MIDI access permissions
5. Try using Google Chrome or Microsoft Edge, which have better WebMIDI support
