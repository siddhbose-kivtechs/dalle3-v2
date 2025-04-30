
    document.addEventListener("DOMContentLoaded", () => {
      // DOM Elements
      const form = document.getElementById("imageForm");
      const output = document.getElementById("output");
      const loader = document.getElementById("loader");
      const status = document.getElementById("status");
      const resetBtn = document.getElementById("resetBtn");
      
      // API Configuration
      const API_ENDPOINT = "http://localhost:4000/api/image/dalle3/bson";
      
      // Get the original input element
      let promptInput = document.getElementById("prompt");
      
      // Convert input to auto-expandable field and store the NEW reference
      promptInput = convertToAutoExpandingInput(promptInput);
      
      // Track generation state
      let isGenerating = false;

      // Set up main form submission handler
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Prevent multiple submissions
        if (isGenerating) {
          showStatus("Already generating an image, please wait...", "warning");
          return;
        }

        // Validate prompt
        const prompt = promptInput.value.trim();
        if (!prompt || prompt.length === 0) {
          showStatus("Please enter a prompt", "error");
          promptInput.classList.add("error");
          return;
        }

        // Clear any previous error states
        clearErrorState(promptInput);

        // Get form values
        const size = document.getElementById("size").value;
        const n = parseInt(document.getElementById("n").value);
        const payload = { prompt, size, n };

        // Start generation process
        isGenerating = true;
        loader.classList.remove("hidden");
        output.innerHTML = "";
        showStatus("Generating image...", "loading");

        // Track request timing
        const startTime = performance.now();
        
        try {
          // Serialize the payload to BSON
          const bsonData = BSON.serialize(payload);
          
          // Make the API request
          const res = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/bson",
            },
            body: bsonData,
              credentials: 'include' 
          });

          console.log("Server Response Status:", res.status);
          console.log("Response Headers:", res.headers);
          
          if (res.ok && res.headers.get("Content-Type") === "application/bson") {
            // Handle BSON response
            const buffer = await res.arrayBuffer();
            const result = BSON.deserialize(new Uint8Array(buffer));
            console.log("Server Response Data:", result);

            if (result.status === "error" || result.error) {
              handleErrorResponse(result.error || { message: result.message || "Unknown error" });
            } else {
              renderImages(result);
              showStatus("Image generated successfully!", "success");
              
              // Display timing information if available
              if (result.timing) {
                displayTimingInfo(result.timing, performance.now() - startTime);
              }
            }
          } else {
            // Handle non-BSON responses
            try {
              const text = await res.text();
              // Try to parse as JSON first
              try {
                const errorData = JSON.parse(text);
                handleErrorResponse(errorData.error || { message: text });
              } catch (parseErr) {
                // If not JSON, just display the text
                output.innerHTML = `<pre>Server error: ${text}</pre>`;
                showStatus("Server error occurred", "error");
              }
            } catch (textErr) {
              output.innerHTML = `<pre>Server error: Unable to read response</pre>`;
              showStatus("Server error occurred", "error");
            }
          }
        } catch (err) {
          output.innerHTML = `<pre>Request failed: ${err.message}</pre>`;
          showStatus("Request failed", "error");
        } finally {
          loader.classList.add("hidden");
          isGenerating = false;
        }
      });

      // Add input event listener to clear error state when user types
      promptInput.addEventListener("input", function() {
        if (this.value.trim().length > 0) {
          clearErrorState(this);
        }
      });
      
      // Add keyboard shortcut (Ctrl+Enter or Cmd+Enter) to submit the form
      promptInput.addEventListener("keydown", function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          form.dispatchEvent(new Event("submit"));
          e.preventDefault();
        }
      });
      
      // Reset button handler
      resetBtn.addEventListener("click", () => {
        form.reset();
        output.innerHTML = "";
        status.textContent = "";
        status.className = "status";
        
        // Reset textarea height
        promptInput.style.height = "auto";
        
        // Update character counter
        const counter = document.querySelector(".char-counter");
        if (counter) counter.textContent = "0 characters";
        
        // Focus on prompt input
        promptInput.focus();
      });
      
      // Set up example prompts
      setupExamplePrompts();

      // Clear error state for a form element
      function clearErrorState(element) {
        element.classList.remove("error");
        const errorElement = document.querySelector(".prompt-error");
        if (errorElement) {
          errorElement.remove();
        }
      }

      // Handle error responses from the server
      function handleErrorResponse(error) {
        let errorMessage = "An error occurred";
        
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && error.message) {
          errorMessage = error.message;

          // Handle specific error cases
          if (error.code === "invalidPayload" && error.message.includes("n=1")) {
            errorMessage = "Multiple images are not available with your current plan. Please select quantity = 1.";
          }
        }

        output.innerHTML = `
          <div class="error-container">
            <div class="error-icon">⚠️</div>
            <div class="error-message">${errorMessage}</div>
          </div>
        `;
        showStatus(errorMessage, "error");
      }

      // Show status message with type-based styling
      function showStatus(message, type) {
        status.textContent = message;
        status.className = "status";
        if (type) status.classList.add(type);
        
        // Auto-hide success messages after 5 seconds
        if (type === "success") {
          setTimeout(() => {
            status.classList.remove("success");
            status.textContent = "";
          }, 5000);
        }
      }

      // Convert an input element to an auto-expanding textarea
      function convertToAutoExpandingInput(element) {
        // Create a div to contain our elements
        const container = document.createElement("div");
        container.className = "auto-expanding-input-container";
        
        // Create the textarea
        const textarea = document.createElement("textarea");
        textarea.id = element.id;
        textarea.name = element.name;
        textarea.placeholder = element.placeholder || "Enter your prompt";
        textarea.required = element.required;
        textarea.value = element.value;
        textarea.className = "auto-expanding-input";
        textarea.rows = 3; // Default rows
        
        // Add a character counter
        const counter = document.createElement("div");
        counter.className = "char-counter";
        counter.textContent = "0 characters";
        
        // Replace the input with our container and add the textarea
        element.parentNode.replaceChild(container, element);
        container.appendChild(textarea);
        container.appendChild(counter);
        
        // Add event listener to auto-expand and update counter
        textarea.addEventListener("input", function() {
          // Reset height to auto and then set to scrollHeight
          this.style.height = "auto";
          this.style.height = (this.scrollHeight) + "px";
          
          // Update character counter
          const charCount = this.value.length;
          counter.textContent = `${charCount} character${charCount !== 1 ? 's' : ''}`;
          
          // Clear any error messages when user starts typing
          if (this.value.trim().length > 0 && this.classList.contains("error")) {
            clearErrorState(this);
          }
        });
        
        // Initial adjustment
        setTimeout(() => {
          textarea.style.height = "auto";
          textarea.style.height = (textarea.scrollHeight) + "px";
          
          // Set initial character count
          counter.textContent = `${textarea.value.length} character${textarea.value.length !== 1 ? 's' : ''}`;
        }, 0);
        
        // Return the new textarea element
        return textarea;
      }

      // Render the generated images
      function renderImages(data) {
        output.innerHTML = ""; // Clear output

        const imagesContainer = document.createElement("div");
        imagesContainer.className = "images-container";

        // Handle different response formats
        const imageItems = data.data || data.images || [];

        if (Array.isArray(imageItems) && imageItems.length > 0) {
          // First, show the prompt that was used
          const promptDisplay = document.createElement("div");
          promptDisplay.className = "prompt-text";
          // Use the updated promptInput reference
          promptDisplay.innerHTML = `<p>Prompt Used:</p><p>${promptInput.value}</p>`;
          output.appendChild(promptDisplay);

          imageItems.forEach((item, i) => {
            const imageContainer = document.createElement("div");
            imageContainer.className = "image-item";

            const imageUrl = typeof item === 'object' ? item.url : item;

            if (imageUrl) {
              // Create image with loading animation
              const img = document.createElement("img");
              img.src = imageUrl;
              img.alt = `Generated Image ${i + 1}`;
              img.className = "generated-image";
              
              // Add loading animation
              img.style.opacity = "0";
              img.onload = function() {
                this.style.transition = "opacity 0.5s ease";
                this.style.opacity = "1";
              };
              
              // Make image clickable to open in new tab
              img.addEventListener("click", () => {
                window.open(imageUrl, "_blank");
              });
              img.title = "Click to view full size image";
              img.style.cursor = "pointer";
              
              imageContainer.appendChild(img);

              const urlDisplay = document.createElement("div");
              urlDisplay.className = "image-url";
              urlDisplay.innerHTML = `<p>Image URL:</p><input type="text" value="${imageUrl}" readonly onClick="this.select();" />`;
              imageContainer.appendChild(urlDisplay);

              const actionButtons = document.createElement("div");
              actionButtons.className = "action-buttons";

              // Copy URL button
              const copyButton = document.createElement("button");
              copyButton.textContent = "Copy URL";
              copyButton.className = "copy-url-btn";
              copyButton.onclick = function () {
                navigator.clipboard.writeText(imageUrl)
                  .then(() => {
                    this.textContent = "Copied!";
                    setTimeout(() => {
                      this.textContent = "Copy URL";
                    }, 2000);
                  })
                  .catch(err => {
                    console.error('Failed to copy: ', err);
                  });
              };
              actionButtons.appendChild(copyButton);

              // Download Button
              const downloadButton = document.createElement("a");
              downloadButton.href = imageUrl;
              downloadButton.download = `dalle3_image_${Date.now()}_${i + 1}.png`;
              downloadButton.textContent = "Download";
              downloadButton.className = "download-btn";
              actionButtons.appendChild(downloadButton);
              
              imageContainer.appendChild(actionButtons);
              imagesContainer.appendChild(imageContainer);
            }
          });

          output.appendChild(imagesContainer);
        } else {
          output.innerHTML = "<div class='error-container'><p>No images found in response</p></div>";
        }
      }
      
      // Display timing information from the API and client
      function displayTimingInfo(timing, clientTime) {
        if (!timing) return;
        
        const timingContainer = document.createElement("div");
        timingContainer.className = "timing-info";
        
        let timingHtml = "<h3>Performance Metrics</h3>";
        
        // Create a table for the timing data
        timingHtml += "<table>";
        
        // Add server-side timings
        Object.entries(timing).forEach(([key, value]) => {
          const formattedKey = key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
            
          timingHtml += `
            <tr>
              <td>${formattedKey}</td>
              <td>${parseFloat(value).toFixed(2)}s</td>
            </tr>
          `;
        });
        
        // Add client-side timing
        timingHtml += `
          <tr>
            <td>Client Processing</td>
            <td>${(clientTime / 1000).toFixed(2)}s</td>
          </tr>
        `;
        
        timingHtml += "</table>";
        
        timingContainer.innerHTML = timingHtml;
        output.appendChild(timingContainer);
      }
      
      // Set up example prompts
      function setupExamplePrompts() {
        const exampleBtns = document.querySelectorAll(".example-prompt");
        
        exampleBtns.forEach(btn => {
          btn.addEventListener("click", function() {
            const promptText = this.getAttribute("data-prompt");
            if (promptText) {
              promptInput.value = promptText;
              
              // Update textarea height
              promptInput.style.height = "auto";
              promptInput.style.height = (promptInput.scrollHeight) + "px";
              
              // Update character counter
              const counter = document.querySelector(".char-counter");
              if (counter) {
                counter.textContent = `${promptText.length} character${promptText.length !== 1 ? 's' : ''}`;
              }
              
              // Close details element
              const details = document.querySelector("details");
              if (details) {
                details.open = false;
              }
              
              // Focus on textarea
              promptInput.focus();
            }
          });
        });
      }
    });