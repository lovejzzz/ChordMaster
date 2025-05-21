document.addEventListener('DOMContentLoaded', () => {
    // For debugging
    console.log('ChordMaster initialized');
    // DOM Elements
    const statusMessage = document.getElementById('status-message');
    const chordName = document.getElementById('chord-name');
    const chordType = document.getElementById('chord-type');
    const chordDisplay = document.getElementById('chord-display');
    const scoreElement = document.getElementById('score');
    const timeElement = document.getElementById('time');
    // Feedback is now shown in the multiplier-text element
    const midiStatusElement = document.getElementById('midi-status');
    const voiceLeadingText = document.getElementById('voice-leading-text');
    const multiplierText = document.getElementById('multiplier-text');
    const multiplierElement = document.getElementById('multiplier');
    const multiplierContainer = document.getElementById('multiplier-container');

    // Game state
    let midiAccess = null;
    let activeNotes = new Set();
    let currentChord = null;
    let previousChord = null;  // Track previous chord to avoid repetition
    let gameActive = false;
    let startTime = null;
    let score = 0;
    let timer = null;
    let chordsPlayed = 0;
    let rankings = [];
    let playerName = '';
    
    // Voice leading tracking
    let previousHighestNote = null;
    let voiceLeadingMultiplier = 1;
    let lastPlayedNotes = [];

    // Constants
    // Use both sharp and flat notations for notes
    const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const CHORD_TYPES = ['', 'm'];
    const CHORD_INTERVALS = {
        '': [0, 4, 7],    // Major chord intervals (root, major third, perfect fifth)
        'm': [0, 3, 7]    // Minor chord intervals (root, minor third, perfect fifth)
    };
    const CHORDS_PER_GAME = 10;
    const RANKING_STORAGE_KEY = 'chordMasterRankings';

    // Initialize MIDI
    function initMIDI() {
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess()
                .then(onMIDISuccess, onMIDIFailure);
        } else {
            midiStatusElement.textContent = 'MIDI Status: WebMIDI not supported in this browser';
            statusMessage.textContent = 'WebMIDI is not supported in this browser. Try using Chrome or Edge.';
        }
    }

    // MIDI Success handler
    function onMIDISuccess(access) {
        midiAccess = access;
        midiStatusElement.textContent = 'MIDI Status: Connected';
        statusMessage.textContent = '';
        
        // Make chord display clickable to start game
        chordDisplay.classList.add('ready');
        chordName.textContent = 'Start!';
        chordType.textContent = '';
        
        // Force a reflow to ensure styles are applied
        void chordDisplay.offsetWidth;

        // Listen for MIDI connection changes
        midiAccess.addEventListener('statechange', updateDevices);
        
        // Set up initial devices
        updateDevices();
        
        // Load rankings from local storage
        loadRankings();
    }

    // MIDI Failure handler
    function onMIDIFailure() {
        midiStatusElement.textContent = 'MIDI Status: Failed to connect';
        statusMessage.textContent = 'Failed to access your MIDI devices. Please check connections and permissions.';
    }

    // Update MIDI devices
    function updateDevices() {
        // Set up listeners for all MIDI inputs
        midiAccess.inputs.forEach(input => {
            input.addEventListener('midimessage', handleMIDIMessage);
        });

        // Update status based on available inputs
        if (midiAccess.inputs.size > 0) {
            let deviceNames = [];
            midiAccess.inputs.forEach(device => deviceNames.push(device.name));
            midiStatusElement.textContent = `MIDI Status: Connected to ${deviceNames.join(', ')}`;
        } else {
            midiStatusElement.textContent = 'MIDI Status: No devices detected';
            statusMessage.textContent = 'No MIDI devices detected. Please connect a MIDI keyboard.';
            // Remove chord display click functionality when no MIDI devices
            chordDisplay.classList.remove('ready');
            chordDisplay.removeEventListener('click', startGame);
        }
    }

    // Handle incoming MIDI messages
    function handleMIDIMessage(event) {
        const [status, note, velocity] = event.data;
        
        // Note on event (144) with velocity > 0
        if ((status & 0xF0) === 0x90 && velocity > 0) {
            noteOn(note);
        }
        // Note off event (128) or note on with velocity 0
        else if ((status & 0xF0) === 0x80 || ((status & 0xF0) === 0x90 && velocity === 0)) {
            noteOff(note);
        }
    }

    // Handle note on events
    function noteOn(noteNumber) {
        activeNotes.add(noteNumber);
        
        if (gameActive && currentChord) {
            checkChord();
        }
    }

    // Handle note off events
    function noteOff(noteNumber) {
        activeNotes.delete(noteNumber);
    }

    // Generate a random chord
    function generateRandomChord() {
        let rootNote, typeIndex, type, useFlat;
        let isDifferentChord = false;
        
        // Keep generating until we get a different chord than the previous one
        while (!isDifferentChord) {
            rootNote = Math.floor(Math.random() * 12); // 0-11 for C through B
            typeIndex = Math.floor(Math.random() * CHORD_TYPES.length);
            type = CHORD_TYPES[typeIndex];
            
            // Check if this is different from the previous chord
            if (previousChord === null || 
                previousChord.root !== rootNote || 
                previousChord.type !== type) {
                isDifferentChord = true;
            }
        }
        
        // Randomly choose between sharp and flat notation (50% chance each)
        useFlat = Math.random() > 0.5;
        const noteName = useFlat ? NOTE_NAMES_FLAT[rootNote] : NOTE_NAMES_SHARP[rootNote];
        
        const newChord = {
            root: rootNote,
            type: type,
            name: noteName + type,
            intervals: CHORD_INTERVALS[type],
            useFlat: useFlat
        };
        
        // Update previousChord for next time
        previousChord = newChord;
        
        return newChord;
    }

    // Display the current chord
    function displayChord(chord) {
        // For minor chords, show as "Dm", for major chords just show "D"
        // Use the name property which already has the correct notation (sharp or flat)
        chordName.textContent = chord.name;
        chordType.textContent = (chordsPlayed + 1) + '/' + CHORDS_PER_GAME;
        
        // Update the chord display style
        chordDisplay.className = 'chord-display';
        chordDisplay.classList.add(chord.type === '' ? 'major' : 'minor');
        chordDisplay.classList.add('pulse');
        
        // Remove the pulse animation after it completes
        setTimeout(() => {
            chordDisplay.classList.remove('pulse');
        }, 500);
    }

    // Check if the played notes form the correct chord
    function checkChord() {
        if (!gameActive || !currentChord) return;
        
        // Get the actual MIDI note numbers (not just pitch classes)
        const playedNotes = Array.from(activeNotes);
        
        // Convert active notes to pitch classes (0-11)
        const pitchClasses = new Set();
        playedNotes.forEach(note => {
            pitchClasses.add(note % 12);
        });
        
        // We need at least 3 notes to form a triad
        if (pitchClasses.size < 3) return;
        
        // Check if the notes form the current chord
        const expectedNotes = new Set();
        currentChord.intervals.forEach(interval => {
            expectedNotes.add((currentChord.root + interval) % 12);
        });
        
        // Check if all expected notes are played
        const allExpectedNotesPlayed = Array.from(expectedNotes).every(note => pitchClasses.has(note));
        
        // Check if any extra notes are played
        const noExtraNotes = Array.from(pitchClasses).every(note => expectedNotes.has(note));
        
        if (allExpectedNotesPlayed && noExtraNotes) {
            // Correct chord played
            const endTime = performance.now();
            const timeTaken = (endTime - startTime) / 1000; // Convert to seconds
            
            // Calculate score based on time (faster = more points)
            // Base score: 100 points, minus 10 points for each second taken, minimum 10 points
            let timeScore = Math.max(100 - Math.floor(timeTaken * 10), 10);
            
            // Get all the actual notes being played (not just pitch classes)
            // Sort them to easily identify the highest note
            const sortedNotes = [...playedNotes].sort((a, b) => a - b);
            const highestNote = sortedNotes[sortedNotes.length - 1];
            
            // Check for voice leading bonus
            let voiceLeadingBonus = 0;
            let hasVoiceLeading = false;
            
            // Debug information
            console.log('Current highest note:', highestNote);
            console.log('Previous highest note:', previousHighestNote);
            
            if (previousHighestNote !== null) {
                // Calculate the interval between the previous and current highest notes
                // We need to use modulo 12 to get the pitch class interval (0-11)
                // This handles octave differences correctly
                const semitones = Math.abs(highestNote - previousHighestNote) % 12;
                
                // Voice leading is considered good if:
                // 1. The highest note remains the same (common tone, interval of 0)
                // 2. The highest notes are a half or whole step apart (intervals of 1 or 2 semitones)
                // 3. The highest notes are a perfect 4th/5th apart (intervals of 5 or 7 semitones)
                // This covers most musical voice leading scenarios
                if (semitones === 0 || semitones === 1 || semitones === 2 || semitones === 5 || semitones === 7) {
                    hasVoiceLeading = true;
                    voiceLeadingMultiplier++;
                    
                    // No cap on multiplier - it can go beyond x5
                    
                    // Apply the voice leading bonus
                    voiceLeadingBonus = timeScore * (voiceLeadingMultiplier - 1);
                    
                    // Debug information
                    console.log('Good voice leading detected! Interval:', semitones);
                    console.log('New multiplier:', voiceLeadingMultiplier);
                    console.log('Voice leading bonus:', voiceLeadingBonus);
                    
                    // Show voice leading feedback with actual score calculation
                    showVoiceLeadingFeedback(true, voiceLeadingMultiplier, timeScore, voiceLeadingBonus);
                } else {
                    // Break the voice leading streak
                    console.log('Voice leading broken. Interval:', semitones);
                    if (voiceLeadingMultiplier > 1) {
                        breakVoiceLeadingStreak();
                        voiceLeadingMultiplier = 1;
                        multiplierElement.textContent = `x1`;
                        multiplierContainer.classList.remove('active');
                    }
                }
            }
            
            // Update the previous highest note for the next chord
            previousHighestNote = highestNote;
            lastPlayedNotes = playedNotes;
            
            // Add the score with any voice leading bonus
            const totalScore = timeScore + voiceLeadingBonus;
            score += totalScore;
            
            // Update UI
            scoreElement.textContent = score;
            timeElement.textContent = timeTaken.toFixed(1) + 's';
            multiplierElement.textContent = `x${voiceLeadingMultiplier}`;
            
            // Show multiplier if active
            if (voiceLeadingMultiplier > 1) {
                multiplierContainer.classList.add('active');
            } else {
                multiplierContainer.classList.remove('active');
            }
            
            // Update feedback text
            let feedbackText = `Correct! +${timeScore} points (${timeTaken.toFixed(1)}s)`;
            if (voiceLeadingBonus > 0) {
                feedbackText += ` +${voiceLeadingBonus} voice leading bonus!`;
            }
            multiplierText.textContent = feedbackText;
            multiplierText.className = 'multiplier-text active';
            
            // Increment chords played
            chordsPlayed++;
            
            // Check if game is complete
            if (chordsPlayed >= CHORDS_PER_GAME) {
                endGame();
            } else {
                // Instantly proceed to next chord
                nextChord();
            }
        } else {
            // Try to identify what chord they're actually playing
            const playedChord = identifyChord(pitchClasses);
            
            // Break voice leading streak when playing a wrong chord
            if (voiceLeadingMultiplier > 1) {
                console.log('Voice leading broken due to wrong chord');
                breakVoiceLeadingStreak();
                voiceLeadingMultiplier = 1;
                multiplierElement.textContent = `x1`;
                multiplierContainer.classList.remove('active');
            }
            
            if (playedChord) {
                multiplierText.textContent = `Wrong chord, you are playing ${playedChord}`;
                multiplierText.className = 'multiplier-text incorrect';
            }
        }
    }
    
    // Show voice leading feedback with animations
    function showVoiceLeadingFeedback(active, multiplier, baseScore, bonusScore) {
        // Clear any existing classes
        voiceLeadingText.className = '';
        multiplierText.className = '';
        
        // Set the text content based on multiplier
        if (multiplier >= 10) {
            voiceLeadingText.textContent = 'UNSTOPPABLE VOICE LEADING!';
        } else if (multiplier === 9) {
            voiceLeadingText.textContent = 'INCREDIBLE VOICE LEADING!';
        } else if (multiplier === 8) {
            voiceLeadingText.textContent = 'PHENOMENAL VOICE LEADING!';
        } else if (multiplier === 7) {
            voiceLeadingText.textContent = 'EXTRAORDINARY VOICE LEADING!';
        } else if (multiplier === 6) {
            voiceLeadingText.textContent = 'AMAZING VOICE LEADING!';
        } else if (multiplier === 5) {
            voiceLeadingText.textContent = 'FANTASTIC VOICE LEADING!';
        } else if (multiplier === 4) {
            voiceLeadingText.textContent = 'AWESOME VOICE LEADING!';
        } else if (multiplier === 3) {
            voiceLeadingText.textContent = 'GREAT VOICE LEADING!';
        } else {
            voiceLeadingText.textContent = 'NICE VOICE LEADING!';
        }
        
        // Add the active class to show the text
        voiceLeadingText.classList.add('voice-leading-active');
        
        // Add the multiplier class for size/color based on streak
        // For multipliers beyond 10, use a special class
        if (multiplier > 10) {
            // For multipliers like 11-19, use class 10
            // For multipliers like 20, 30, etc. use the tens digit with a 0
            const tensDigit = Math.floor(multiplier / 10);
            const remainder = multiplier % 10;
            
            if (remainder === 0) {
                voiceLeadingText.classList.add(`voice-leading-multiplier-${tensDigit}0`);
            } else {
                voiceLeadingText.classList.add('voice-leading-multiplier-10');
            }
        } else {
            voiceLeadingText.classList.add(`voice-leading-multiplier-${multiplier}`);
        }
        
        // Show the multiplier text with actual score calculation and animation
        if (multiplier > 1 && baseScore && bonusScore) {
            const totalScore = baseScore + bonusScore;
            
            // Start with just the base score
            multiplierText.textContent = `${baseScore}`;
            multiplierText.classList.add('multiplier-fade');
            multiplierText.classList.add('active'); // Add fire animation
            
            // Animated calculation sequence
            setTimeout(() => {
                // Add the multiplier
                multiplierText.textContent = `${baseScore} ×${multiplier}`;
                multiplierText.classList.add('calculation-step');
            }, 600);
            
            setTimeout(() => {
                // Show the equals sign
                multiplierText.textContent = `${baseScore} ×${multiplier} =`;
                multiplierText.classList.add('calculation-step');
            }, 1200);
            
            setTimeout(() => {
                // Show the final result with exclamation
                multiplierText.textContent = `${baseScore} ×${multiplier} = ${totalScore}!`;
                multiplierText.classList.add('calculation-final');
            }, 1800);
        } else {
            multiplierText.textContent = `×${multiplier}!`;
            multiplierText.classList.add('multiplier-fade');
        }
        
        // Remove the multiplier text animation after it completes
        setTimeout(() => {
            multiplierText.classList.remove('multiplier-fade');
            multiplierText.classList.remove('active');
        }, 3000);
    }
    
    // Break the voice leading streak with animation
    function breakVoiceLeadingStreak() {
        // Add the break animation
        voiceLeadingText.classList.add('voice-leading-break');
        
        // Immediately update the multiplier text to x1
        multiplierText.textContent = 'x1!';
        multiplierText.classList.add('multiplier-fade');
        
        // Remove all animations after they complete
        setTimeout(() => {
            voiceLeadingText.className = '';
            voiceLeadingText.textContent = '';
            multiplierText.classList.remove('multiplier-fade');
        }, 1000);
    }
    
    // Identify what chord is being played
    function identifyChord(pitchClasses) {
        if (pitchClasses.size < 3) return null;
        
        // Try to identify the chord by checking all possible roots and types
        for (let root = 0; root < 12; root++) {
            for (let typeIndex = 0; typeIndex < CHORD_TYPES.length; typeIndex++) {
                const type = CHORD_TYPES[typeIndex];
                const intervals = CHORD_INTERVALS[type];
                
                // Generate expected notes for this chord
                const chordNotes = new Set();
                intervals.forEach(interval => {
                    chordNotes.add((root + interval) % 12);
                });
                
                // Check if all expected notes are played
                const allChordNotesPlayed = Array.from(chordNotes).every(note => 
                    pitchClasses.has(note));
                
                // Check if no extra notes are played
                const noExtraNotes = Array.from(pitchClasses).every(note => 
                    chordNotes.has(note));
                
                if (allChordNotesPlayed && noExtraNotes) {
                    // Randomly choose between sharp and flat notation for feedback
                    const useFlat = Math.random() > 0.5;
                    const noteName = useFlat ? NOTE_NAMES_FLAT[root] : NOTE_NAMES_SHARP[root];
                    return noteName + type;
                }
            }
        }
        
        return null;
    }

    // Start the game
    function startGame() {
        score = 0;
        chordsPlayed = 0;
        voiceLeadingMultiplier = 1;
        previousHighestNote = null;
        lastPlayedNotes = [];
        previousChord = null; // Reset previous chord tracking
        
        // Show score and time modules now that the game is starting
        const leftBox = document.querySelector('.left-box');
        const rightBox = document.querySelector('.right-box');
        if (leftBox) leftBox.style.display = 'block';
        if (rightBox) rightBox.style.display = 'block';
        
        scoreElement.textContent = score;
        // Clear any existing feedback
        multiplierText.textContent = '';
        multiplierText.className = '';
        multiplierElement.textContent = 'x1';
        multiplierContainer.classList.remove('active');
        voiceLeadingText.className = '';
        voiceLeadingText.textContent = '';
        multiplierText.className = '';
        multiplierText.textContent = '';
        
        // Remove click event during gameplay
        chordDisplay.removeEventListener('click', startGame);
        chordDisplay.classList.remove('ready');
        
        nextChord();
    }
    
    // End the game
    function endGame() {
        gameActive = false;
        clearInterval(timer);
        
        statusMessage.textContent = `Game Over! Final Score: ${score}`;
        multiplierText.textContent = `Game complete! You scored ${score} points in ${CHORDS_PER_GAME} chords.`;
        multiplierText.className = 'multiplier-text active';
        
        chordName.textContent = 'Done!';
        chordType.textContent = `${CHORDS_PER_GAME}/${CHORDS_PER_GAME}`;
        
        // Show name input for ranking
        showNameInput();
    }
    
    // Show name input for ranking
    function showNameInput() {
        // Create modal for name input
        const modal = document.createElement('div');
        modal.className = 'name-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'name-modal-content';
        
        const heading = document.createElement('h2');
        heading.textContent = `Your Score: ${score}`;
        
        const instruction = document.createElement('p');
        instruction.textContent = 'Enter your name for the leaderboard:';
        
        const form = document.createElement('form');
        form.onsubmit = function(e) {
            e.preventDefault();
            submitScore();
        };
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'player-name';
        input.maxLength = 20;
        input.required = true;
        input.placeholder = 'Your Name';
        
        // Set the input value to the last used player name if available
        if (playerName) {
            input.value = playerName;
            // Select the text so it's easy to edit or replace
            setTimeout(() => {
                input.select();
            }, 50);
        }
        
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'Submit Score';
        
        form.appendChild(input);
        form.appendChild(submitButton);
        
        modalContent.appendChild(heading);
        modalContent.appendChild(instruction);
        modalContent.appendChild(form);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
        
        // Focus on the input field
        input.focus();
    }
    
    // Submit score to rankings
    function submitScore() {
        const nameInput = document.getElementById('player-name');
        playerName = nameInput.value.trim();
        
        if (playerName) {
            // Check if this is a new high score before adding it
            const isHighestScore = rankings.length === 0 || score > rankings[0].score;
            
            // Add score to rankings
            rankings.push({
                name: playerName,
                score: score,
                date: new Date().toISOString()
            });
            
            // Sort rankings by score (highest first)
            rankings.sort((a, b) => b.score - a.score);
            
            // Keep only top 10 scores
            if (rankings.length > 10) {
                rankings = rankings.slice(0, 10);
            }
            
            // Save to local storage
            saveRankings();
            
            // Remove modal
            const modal = document.querySelector('.name-modal');
            if (modal) {
                document.body.removeChild(modal);
            }
            
            // If this is the highest score, show a congratulatory message
            if (isHighestScore) {
                showHighScoreCongrats();
            }
            
            // Show rankings
            showRankings();
            
            // Reset game state
            resetGameState();
        }
    }
    
    // Show rankings
    function showRankings() {
        // Update the rankings display
        displayRankings();
        
        // Reset game state to prepare for next game
        // (No play again button needed as the chord display will be clickable)
        resetGameState();
    }
    
    // Show congratulatory message for highest score
    function showHighScoreCongrats() {
        // Create a congratulations overlay
        const congrats = document.createElement('div');
        congrats.className = 'high-score-congrats';
        
        const congratsContent = document.createElement('div');
        congratsContent.className = 'congrats-content';
        
        const congratsHeading = document.createElement('h1');
        congratsHeading.textContent = 'NEW HIGH SCORE!';
        
        const congratsMessage = document.createElement('p');
        congratsMessage.textContent = `Congratulations ${playerName}! You've achieved the highest score of ${score} points!`;
        
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Continue';
        closeButton.addEventListener('click', function() {
            document.body.removeChild(congrats);
        });
        
        // Add confetti effect classes
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.animationDelay = Math.random() * 5 + 's';
            confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
            congrats.appendChild(confetti);
        }
        
        congratsContent.appendChild(congratsHeading);
        congratsContent.appendChild(congratsMessage);
        congratsContent.appendChild(closeButton);
        congrats.appendChild(congratsContent);
        
        document.body.appendChild(congrats);
        
        // Auto-remove after 7 seconds
        setTimeout(() => {
            if (document.body.contains(congrats)) {
                document.body.removeChild(congrats);
            }
        }, 7000);
    }
    
    // Reset game state to start a new game
    function resetGameState() {
        // Reset UI
        statusMessage.textContent = '';  // Remove the message
        // Clear any existing feedback
        multiplierText.textContent = '';
        multiplierText.className = '';
        
        // Reset voice leading elements
        voiceLeadingText.className = '';
        voiceLeadingText.textContent = '';
        multiplierText.className = '';
        multiplierText.textContent = '';
        multiplierContainer.classList.remove('active');
        
        // Hide score and time modules when game is reset
        document.querySelector('.game-layout').style.display = 'none';
        
        // Reset chord display
        chordName.textContent = 'Start!';
        chordType.textContent = '';
        chordDisplay.className = 'chord-display ready';
        
        // Make chord display clickable again
        chordDisplay.addEventListener('click', startGame);
    }
    
    // Save rankings to local storage
    function saveRankings() {
        localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(rankings));
    }
    
    // Load rankings from local storage
    function loadRankings() {
        const storedRankings = localStorage.getItem(RANKING_STORAGE_KEY);
        if (storedRankings) {
            rankings = JSON.parse(storedRankings);
        }
        
        // Display rankings immediately after loading
        displayRankings();
    }
    
    // Display rankings in the rankings container
    function displayRankings() {
        const rankingsContainer = document.getElementById('rankings-container');
        rankingsContainer.innerHTML = '';
        
        // Create rankings table
        const rankingsTitle = document.createElement('h2');
        rankingsTitle.textContent = 'Leaderboard';
        rankingsContainer.appendChild(rankingsTitle);
        
        if (rankings.length === 0) {
            const noRankingsMessage = document.createElement('p');
            noRankingsMessage.textContent = 'No scores yet. Be the first to play!';
            rankingsContainer.appendChild(noRankingsMessage);
            return;
        }
        
        const table = document.createElement('table');
        table.className = 'rankings-table';
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        const rankHeader = document.createElement('th');
        rankHeader.textContent = 'Rank';
        
        const nameHeader = document.createElement('th');
        nameHeader.textContent = 'Name';
        
        const scoreHeader = document.createElement('th');
        scoreHeader.textContent = 'Score';
        
        headerRow.appendChild(rankHeader);
        headerRow.appendChild(nameHeader);
        headerRow.appendChild(scoreHeader);
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        rankings.forEach((entry, index) => {
            const row = document.createElement('tr');
            
            // Highlight current player's score
            if (entry.name === playerName && entry.score === score) {
                row.className = 'current-player';
            }
            
            const rankCell = document.createElement('td');
            rankCell.textContent = index + 1;
            
            const nameCell = document.createElement('td');
            nameCell.textContent = entry.name;
            
            const scoreCell = document.createElement('td');
            scoreCell.textContent = entry.score;
            
            row.appendChild(rankCell);
            row.appendChild(nameCell);
            row.appendChild(scoreCell);
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        rankingsContainer.appendChild(table);
    }

    // Move to the next chord
    function nextChord() {
        // Clear active notes
        activeNotes.clear();
        
        // Generate a new random chord
        currentChord = generateRandomChord();
        displayChord(currentChord);
        
        // Update UI
        statusMessage.textContent = '';
        // Clear any existing feedback
        multiplierText.textContent = '';
        multiplierText.className = '';
        
        // Start timing
        startTime = performance.now();
        let elapsed = 0;
        
        // Update the timer display
        clearInterval(timer);
        timer = setInterval(() => {
            elapsed = (performance.now() - startTime) / 1000;
            timeElement.textContent = elapsed.toFixed(1) + 's';
        }, 100);
        
        // Activate the game
        gameActive = true;
    }

    // No need for start button event listener as we're using the chord display

    // Make sure the chord display is visible and properly styled
    const chordDisplayElement = document.getElementById('chord-display');
    if (chordDisplayElement) {
        chordDisplayElement.style.display = 'flex';
    }
    
    // Hide score boxes initially
    const leftBox = document.querySelector('.left-box');
    const rightBox = document.querySelector('.right-box');
    if (leftBox) leftBox.style.display = 'none';
    if (rightBox) rightBox.style.display = 'none';
    
    // Initialize the application
    initMIDI();
    
    // Add a direct click handler to the chord display for testing
    // This ensures the chord display is clickable even if MIDI initialization has issues
    chordDisplay.addEventListener('click', function() {
        console.log('Chord display clicked');
        if (chordDisplay.classList.contains('ready')) {
            startGame();
        }
    });
    
    // Add spacebar functionality to start game and submit scores
    document.addEventListener('keydown', function(event) {
        // Check if the key pressed is the spacebar
        if (event.code === 'Space' || event.key === ' ') {
            // Prevent default spacebar behavior (like scrolling the page)
            event.preventDefault();
            
            // If the game is ready to start, start it
            if (chordDisplay.classList.contains('ready')) {
                startGame();
            }
            
            // If the name input modal is open, submit the score
            const nameModal = document.querySelector('.name-modal');
            if (nameModal) {
                const nameInput = document.getElementById('player-name');
                if (nameInput && nameInput.value.trim()) {
                    submitScore();
                }
            }
        }
    });
});
