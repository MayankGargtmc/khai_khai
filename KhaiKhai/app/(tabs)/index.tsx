// App.tsx - TypeScript implementation of Khai-Khai preference ranking game

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';

// Type definitions
type GameState = 'initial' | 'setup' | 'playing' | 'result';
type ComparisonStrategy = 'quicksort' | 'tournament';
type ComparisonPair = [string, string];
type PreferenceGraph = Record<string, string[]>;
type Progress = {
  completed: number;
  total: number;
};

const App = () => {
  // Game states with proper typing
  const [gameState, setGameState] = useState<GameState>('initial');
  const [itemCount, setItemCount] = useState<number>(4);
  const [items, setItems] = useState<string[]>([]);
  const [currentItem, setCurrentItem] = useState<string>('');
  const [comparisons, setComparisons] = useState<ComparisonPair[]>([]);
  const [currentComparison, setCurrentComparison] = useState<ComparisonPair | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [graph, setGraph] = useState<PreferenceGraph>({}); // Store preferences as directed graph
  const [progress, setProgress] = useState<Progress>({ completed: 0, total: 0 });
  const [comparisonStrategy, setComparisonStrategy] = useState<ComparisonStrategy>('quicksort');

  // Handle item count input
  const handleItemCountChange = (value: string): void => {
    const count = parseInt(value);
    if (!isNaN(count) && count >= 2) {
      setItemCount(count);
    }
  };

  // Start item entry phase
  const startSetup = (): void => {
    if (itemCount > 50) {
      Alert.alert('Warning', 'Large numbers of items may require many comparisons. Consider using fewer items for better experience.');
    }
    setGameState('setup');
    setItems([]);
  };

  // Add an item to the list
  const addItem = (): void => {
    if (currentItem.trim() === '') {
      Alert.alert('Error', 'Please enter a valid name');
      return;
    }

    if (items.length >= itemCount) {
      Alert.alert('Error', `You can only add ${itemCount} items`);
      return;
    }

    if (items.includes(currentItem.trim())) {
      Alert.alert('Error', 'This item already exists');
      return;
    }

    setItems([...items, currentItem.trim()]);
    setCurrentItem('');
  };

  // Import items from a comma-separated list
  const importItems = (text: string): void => {
    const importedItems = text.split(',')
      .map(item => item.trim())
      .filter(item => item !== '');
    
    if (importedItems.length > itemCount) {
      Alert.alert('Error', `You can only add ${itemCount} items`);
      return;
    }
    
    const uniqueItems = [...new Set(importedItems)];
    setItems(uniqueItems);
  };

  // Start the comparison game
  const startGame = (): void => {
    if (items.length < 2) {
      Alert.alert('Error', 'You need at least 2 items to start the game');
      return;
    }

    if (items.length !== itemCount) {
      Alert.alert('Error', `Please add exactly ${itemCount} items`);
      return;
    }

    // Initialize graph
    const newGraph: PreferenceGraph = {};
    items.forEach(item => {
      newGraph[item] = [];
    });
    setGraph(newGraph);

    setGameState('playing');
    
    // Choose optimal algorithm based on item count
    if (items.length > 10) {
      setComparisonStrategy('quicksort');
      initializeQuicksortComparisons();
    } else {
      setComparisonStrategy('tournament');
      initializeTournamentComparisons();
    }
  };

  // Tournament-style comparisons (good for smaller sets)
  const initializeTournamentComparisons = (): void => {
    const pairs: ComparisonPair[] = [];
    // Generate pairs for tournament style (full round-robin initially)
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        pairs.push([items[i], items[j]]);
      }
    }
    
    const totalComparisons = pairs.length;
    setProgress({ completed: 0, total: totalComparisons });
    setComparisons(pairs);
  };

  // QuickSort-inspired comparisons (better for larger sets)
  const initializeQuicksortComparisons = (): void => {
    // For QuickSort approach, we'll start with a pivot-based approach
    // This won't generate all comparisons upfront, but rather dynamically
    
    // We'll use a state to track what we're currently sorting
    const itemsCopy = [...items];
    
    // We'll estimate the number of comparisons needed for quicksort: n log n
    const estimatedComparisons = Math.ceil(items.length * Math.log2(items.length));
    setProgress({ completed: 0, total: estimatedComparisons });
    
    // Start with first item as pivot against all others
    const initialComparisons: ComparisonPair[] = [];
    const pivot = itemsCopy[0];
    for (let i = 1; i < itemsCopy.length; i++) {
      initialComparisons.push([pivot, itemsCopy[i]]);
    }
    
    setComparisons(initialComparisons);
  };

  // Process quick sort comparisons
  const processQuicksortResult = (preferred: string, lessPreferred: string): void => {
    // Update graph first
    setGraph(prev => {
      const newGraph = {...prev};
      if (!newGraph[preferred]?.includes(lessPreferred)) {
        newGraph[preferred] = [...(newGraph[preferred] || []), lessPreferred];
      }
      return newGraph;
    });
    
    // Update progress
    setProgress(prev => ({
      ...prev,
      completed: prev.completed + 1
    }));
    
    // If we've exhausted current comparisons, generate new ones if needed
    if (comparisons.length === 0) {
      // Try to determine if we have enough information for full sorting
      const partialRanking = generatePartialRanking();
      
      if (partialRanking.length === items.length) {
        // We have a complete ranking, finish the game
        setResults(partialRanking);
        setGameState('result');
      } else {
        // We need more comparisons
        const newComparisons = generateNextQuicksortComparisons(partialRanking);
        if (newComparisons.length > 0) {
          setComparisons(newComparisons);
        } else {
          // If we couldn't generate more meaningful comparisons, finish with what we have
          finishGame();
        }
      }
    }
  };

  // Generate the next batch of comparisons using quicksort strategy
  const generateNextQuicksortComparisons = (partialRanking: string[]): ComparisonPair[] => {
    // Find any two items whose relationship is unknown
    const newComparisons: ComparisonPair[] = [];
    
    // First, look for items not in the partial ranking
    const unrankedItems = items.filter(item => !partialRanking.includes(item));
    
    if (unrankedItems.length > 0) {
      // Compare first unranked item with a few ranked items to place it
      const pivot = unrankedItems[0];
      // Pick 3 well-distributed items from the ranked list to compare against
      const rankLength = partialRanking.length;
      if (rankLength > 0) {
        const indices = [
          0,
          Math.floor(rankLength / 2),
          rankLength - 1
        ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
        
        indices.forEach(idx => {
          newComparisons.push([pivot, partialRanking[idx]]);
        });
      }
    } else {
      // All items are in partial ranking, but we might still have uncertainty
      // Look for potential comparisons that would add information
      for (let i = 0; i < partialRanking.length - 1; i++) {
        for (let j = i + 1; j < partialRanking.length; j++) {
          const a = partialRanking[i];
          const b = partialRanking[j];
          if (!canInfer(a, b)) {
            newComparisons.push([a, b]);
            // Limit the number of new comparisons we add at once
            if (newComparisons.length >= 3) {
              return newComparisons;
            }
          }
        }
      }
    }
    
    return newComparisons;
  };

  // Generate a partial ranking based on current knowledge
  const generatePartialRanking = (): string[] => {
    const completeGraph: PreferenceGraph = { ...graph };
    
    // Function to perform topological sort
    const topologicalSort = (): string[] => {
      // Calculate in-degree for each node
      const inDegree: Record<string, number> = {};
      items.forEach(item => {
        inDegree[item] = 0;
      });
      
      Object.keys(completeGraph).forEach(node => {
        completeGraph[node]?.forEach(neighbor => {
          inDegree[neighbor] = (inDegree[neighbor] || 0) + 1;
        });
      });
      
      // Items with zero in-degree
      const queue: string[] = items.filter(item => inDegree[item] === 0);
      const result: string[] = [];
      
      while (queue.length > 0) {
        const current = queue.shift() as string;
        result.push(current);
        
        completeGraph[current]?.forEach(neighbor => {
          inDegree[neighbor]--;
          if (inDegree[neighbor] === 0) {
            queue.push(neighbor);
          }
        });
      }
      
      return result;
    };
    
    return topologicalSort();
  };

  // Check if we can infer a preference without asking
  const canInfer = (a: string, b: string): boolean => {
    // If we already know directly
    if (graph[a]?.includes(b)) return true;
    if (graph[b]?.includes(a)) return true;

    // Check transitive relationships using DFS
    const visited = new Set<string>();
    
    const dfs = (current: string, target: string): boolean => {
      if (current === target) return true;
      if (!graph[current] || graph[current].length === 0) return false;
      
      visited.add(current);
      
      for (const neighbor of graph[current]) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor, target)) return true;
        }
      }
      
      return false;
    };
    
    return dfs(a, b) || dfs(b, a);
  };

  // Get next comparison pair, skipping those we can infer
  useEffect(() => {
    if (gameState === 'playing' && comparisons.length > 0 && !currentComparison) {
      let nextComparison: ComparisonPair | null = null;
      let nextComparisonIndex = 0;
      
      for (let i = 0; i < comparisons.length; i++) {
        const [a, b] = comparisons[i];
        if (!canInfer(a, b)) {
          nextComparison = comparisons[i];
          nextComparisonIndex = i;
          break;
        } else {
          // If we can infer, update progress
          setProgress(prev => ({
            ...prev,
            completed: prev.completed + 1
          }));
        }
      }
      
      if (nextComparison) {
        setCurrentComparison(nextComparison);
        const remainingComparisons = [...comparisons];
        remainingComparisons.splice(nextComparisonIndex, 1);
        setComparisons(remainingComparisons);
      } else {
        // All comparisons done or can be inferred
        finishGame();
      }
    }
  }, [gameState, comparisons, graph, currentComparison]);

  // Choose between current comparison items
  const chooseItem = (selectedItem: string): void => {
    if (!currentComparison) return;
    
    const [a, b] = currentComparison;
    const preferred = selectedItem === a ? a : b;
    const lessPreferred = selectedItem === a ? b : a;
    
    // Different handling based on algorithm
    if (comparisonStrategy === 'quicksort') {
      processQuicksortResult(preferred, lessPreferred);
    } else {
      // Update preference graph
      setGraph(prev => {
        const newGraph = {...prev};
        if (!newGraph[preferred]?.includes(lessPreferred)) {
          newGraph[preferred] = [...(newGraph[preferred] || []), lessPreferred];
        }
        return newGraph;
      });
      
      // Update progress
      setProgress(prev => ({
        ...prev,
        completed: prev.completed + 1
      }));
    }
    
    // Clear current comparison to trigger the next one
    setCurrentComparison(null);
  };

  // Generate final ranking
  const finishGame = (): void => {
    const ranking = generatePartialRanking();
    setResults(ranking);
    setGameState('result');
  };

  // Reset the game
  const resetGame = (): void => {
    setGameState('initial');
    setItems([]);
    setCurrentItem('');
    setComparisons([]);
    setCurrentComparison(null);
    setResults([]);
    setGraph({});
    setProgress({ completed: 0, total: 0 });
  };

  // Calculate progress percentage
  const getProgressPercentage = (): number => {
    if (progress.total === 0) return 0;
    return Math.min(100, Math.round((progress.completed / progress.total) * 100));
  };

  // Render based on game state
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Khai-Khai</Text>
        <Text style={styles.subtitle}>Preference Ranking Game</Text>
        
        {gameState === 'initial' && (
          <View style={styles.section}>
            <Text style={styles.label}>How many items do you want to rank?</Text>
            <TextInput
              style={styles.input}
              value={itemCount.toString()}
              onChangeText={handleItemCountChange}
              keyboardType="numeric"
              maxLength={2}
            />
            <TouchableOpacity style={styles.button} onPress={startSetup}>
              <Text style={styles.buttonText}>Start</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {gameState === 'setup' && (
          <View style={styles.section}>
            <Text style={styles.label}>
              Enter your items ({items.length}/{itemCount})
            </Text>
            <TextInput
              style={styles.input}
              value={currentItem}
              onChangeText={setCurrentItem}
              placeholder="Enter name or item"
            />
            <TouchableOpacity style={styles.button} onPress={addItem}>
              <Text style={styles.buttonText}>Add Item</Text>
            </TouchableOpacity>
            
            {itemCount > 10 && (
              <View style={styles.importContainer}>
                <Text style={styles.importLabel}>Or import comma-separated items:</Text>
                <TextInput
                  style={styles.importInput}
                  multiline
                  placeholder="Item1, Item2, Item3, ..."
                  onChangeText={(text) => importItems(text)}
                />
              </View>
            )}
            
            <FlatList
              data={items}
              renderItem={({ item }) => (
                <View style={styles.itemContainer}>
                  <Text style={styles.item}>{item}</Text>
                </View>
              )}
              keyExtractor={(item, index) => index.toString()}
              style={styles.list}
            />
            
            {items.length === itemCount && (
              <TouchableOpacity style={styles.button} onPress={startGame}>
                <Text style={styles.buttonText}>Start Ranking</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {gameState === 'playing' && (
          <View style={styles.section}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${getProgressPercentage()}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {progress.completed} / {progress.total} comparisons
              </Text>
            </View>
            
            {currentComparison ? (
              <>
                <Text style={styles.label}>Which do you prefer?</Text>
                <View style={styles.comparisonContainer}>
                  <TouchableOpacity
                    style={styles.choiceButton}
                    onPress={() => chooseItem(currentComparison[0])}
                  >
                    <Text style={styles.choiceText}>{currentComparison[0]}</Text>
                  </TouchableOpacity>
                  
                  <Text style={styles.orText}>OR</Text>
                  
                  <TouchableOpacity
                    style={styles.choiceButton}
                    onPress={() => chooseItem(currentComparison[1])}
                  >
                    <Text style={styles.choiceText}>{currentComparison[1]}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Processing...</Text>
              </View>
            )}
          </View>
        )}
        
        {gameState === 'result' && (
          <View style={styles.section}>
            <Text style={styles.label}>Your Preference Ranking:</Text>
            <View style={styles.resultContainer}>
              {results.map((item, index) => (
                <View key={index} style={styles.rankItem}>
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                  <Text style={styles.rankText}>{item}</Text>
                </View>
              ))}
            </View>
            
            <TouchableOpacity style={styles.button} onPress={resetGame}>
              <Text style={styles.buttonText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2c3e50',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#7f8c8d',
    marginBottom: 30,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#34495e',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  importContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  importLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  importInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 5,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    marginVertical: 15,
    maxHeight: 200,
  },
  itemContainer: {
    backgroundColor: '#ecf0f1',
    padding: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  item: {
    fontSize: 16,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#ecf0f1',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498db',
  },
  progressText: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'right',
    marginTop: 5,
  },
  comparisonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 20,
  },
  choiceButton: {
    backgroundColor: '#2ecc71',
    padding: 15,
    borderRadius: 5,
    width: '40%',
    alignItems: 'center',
  },
  choiceText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  resultContainer: {
    marginVertical: 20,
    maxHeight: 400,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecf0f1',
    padding: 12,
    borderRadius: 5,
    marginBottom: 8,
  },
  rankNumber: {
    backgroundColor: '#3498db',
    color: '#fff',
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: 'center',
    lineHeight: 30,
    marginRight: 10,
    fontWeight: 'bold',
  },
  rankText: {
    fontSize: 16,
  },
});

export default App;