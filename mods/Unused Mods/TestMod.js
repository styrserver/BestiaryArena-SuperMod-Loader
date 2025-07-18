// Test Mod for Bestiary Arena Mod Loader
console.log('Test Mod initializing...');

// Access the API to create a button
if (api) {
  console.log('BestiaryModAPI available in Test Mod');
  
  // Create a button using the API
  api.ui.addButton({
    id: 'test-mod-button',
    text: 'Test Mod',
    tooltip: 'Click to show test mod is working',
    primary: true,
    onClick: function() {
      api.showModal({
        title: 'Test Mod',
        content: '<p>The Test Mod is working correctly!</p>',
        buttons: [
          {
            text: 'Great!',
            primary: true
          }
        ]
      });
      
      console.log('Test Mod button clicked!');
    }
  });
  
  console.log('Test Mod button added');
} else {
  console.error('BestiaryModAPI not available in Test Mod');
}

console.log('Test Mod initialization complete'); 