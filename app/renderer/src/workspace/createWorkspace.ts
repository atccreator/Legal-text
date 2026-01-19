import { Application, Container, Graphics } from 'pixi.js'

export async function createWorkspace(container: HTMLElement) {
  const app = new Application()

  // Get initial size
  const rect = container.getBoundingClientRect()
  
  await app.init({
    width: rect.width,
    height: rect.height,
    backgroundColor: 0xfefefe,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
    backgroundAlpha: 1,
    clearBeforeRender: false,
  })

  // Style canvas to prevent overflow and optimize rendering
  app.canvas.style.display = 'block'
  app.canvas.style.width = '100%'
  app.canvas.style.height = '100%'
  app.canvas.style.position = 'absolute'
  app.canvas.style.top = '0'
  app.canvas.style.left = '0'
  app.canvas.style.willChange = 'transform'

  container.appendChild(app.canvas)

  const world = new Container()
  app.stage.addChild(world)

  // Create infinite dot pattern background
  const dotPattern = createDotPattern()
  world.addChild(dotPattern)

  // Debounced resize to prevent black screen during drag
  let resizeTimer: number | null = null
  let lastWidth = rect.width
  let lastHeight = rect.height
  
  const handleResize = () => {
    if (resizeTimer !== null) {
      clearTimeout(resizeTimer)
    }
    
    resizeTimer = window.setTimeout(() => {
      const newRect = container.getBoundingClientRect()
      const newWidth = Math.floor(newRect.width)
      const newHeight = Math.floor(newRect.height)
      
      // Only resize if dimensions actually changed significantly
      if (newWidth > 0 && newHeight > 0 && 
          (Math.abs(newWidth - lastWidth) > 5 || Math.abs(newHeight - lastHeight) > 5)) {
        lastWidth = newWidth
        lastHeight = newHeight
        app.renderer.resize(newWidth, newHeight)
      }
      resizeTimer = null
    }, 150) // 150ms debounce - smooth resize after drag stops
  }

  const resizeObserver = new ResizeObserver(handleResize)
  resizeObserver.observe(container)

  return { app, world, resizeObserver, grid: dotPattern }
}

function createDotPattern(): Graphics {
  const dotPattern = new Graphics()
  const dotSize = 2
  const dotSpacing = 30
  const dotExtent = 10000
  const dotColor = 0xd1d5db // Light gray
  
  // Draw dots in a grid pattern - PixiJS v8 API
  for (let x = -dotExtent; x <= dotExtent; x += dotSpacing) {
    for (let y = -dotExtent; y <= dotExtent; y += dotSpacing) {
      dotPattern.circle(x, y, dotSize)
    }
  }
  
  dotPattern.fill({ color: dotColor, alpha: 0.6 })
  
  return dotPattern
}
