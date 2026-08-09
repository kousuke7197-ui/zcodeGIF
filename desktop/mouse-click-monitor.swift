#!/usr/bin/env swift
// mouse-click-monitor.swift
// 监听全局鼠标左键点击事件，输出坐标到 stdout（格式：x,y）
// 需要辅助功能权限（Accessibility）

import Cocoa

// 检查并请求辅助功能权限
let trusted = AXIsProcessTrusted()
if !trusted {
    let options: NSDictionary = [
        kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true
    ]
    _ = AXIsProcessTrustedWithOptions(options)
    // 即使没有权限也继续运行，事件 tap 创建失败时会自动退出
}

let eventMask = (1 << CGEventType.leftMouseDown.rawValue)

guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: CGEventMask(eventMask),
    callback: { _, type, event, _ in
        if type == .leftMouseDown {
            let location = event.location
            print("\(Int(location.x)),\(Int(location.y))")
            fflush(stdout)
        }
        return Unmanaged.passUnretained(event)
    },
    userInfo: nil
) else {
    // 无法创建事件 tap（通常是权限不足），静默退出
    exit(1)
}

let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)
CFRunLoopRun()
