#!/usr/bin/env python3
"""
KICS 2026 Treasure Hunt - Automated End-to-End Test Suite
Tests:
1. Question Format Verification (Stages 1-4 MCQs with 0 checked, Stage 5 ONLY text input)
2. Zero-Leak Spoiler Check on Stage 5 (DOM free of 'kala' or 'leishmania', blank value, correct placeholder)
3. Time-Based Scoring & Single-Attempt Penalty (0 for wrong on Stage 1 + reload check, ~900 for Stage 2 after 10s)
4. Keystroke Collision & Input Isolation Test
5. Auto-Unlock Test (?unlock=VIDHANA1956)
6. 100-Delegate Leaderboard Stress Test (Podium sorting, ticker rendering, presenter controls)
"""

import os
import sys
import time
import threading
import http.server
import socketserver
from playwright.sync_api import sync_playwright

PORT = 8891
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SERVER_DIR, **kwargs)

    def log_message(self, format, *args):
        pass

def start_server():
    server = socketserver.TCPServer(("", PORT), QuietHandler)
    server.allow_reuse_address = True
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server

def run_tests():
    server = start_server()
    print(f"🚀 Local test HTTP server running at http://localhost:{PORT}")
    time.sleep(1)

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # ========================================================
        # TEST SUITE 1: QUESTION FORMAT VERIFICATION
        # ========================================================
        print("\n" + "="*60)
        print("TEST SUITE 1: Question Format Verification (Stages 1-4 MCQ, Stage 5 Text Input)")
        print("="*60)

        page.goto(f"http://localhost:{PORT}/#hunt")
        page.wait_for_selector("#registration-modal")

        # Fill and submit registration
        page.locator("#reg-name").fill("Dr. Raghavendra")
        page.locator("#reg-hospital").fill("Manipal Hospital Sarjapur Road")
        page.locator("#reg-mobile").fill("+91 98450 12345")
        page.locator("#registration-form").dispatch_event("submit")
        time.sleep(0.5)

        # Check Stages 1 to 4: strictly MCQs (radio buttons), none pre-selected
        mcq_pass = True
        for s in range(1, 5):
            radio_count = page.locator(f"input[name='stage{s}-opt'][type='radio']").count()
            checked_count = page.locator(f"input[name='stage{s}-opt'][type='radio']:checked").count()
            has_text_input = page.locator(f"#stage{s}-content input[type='text'], #stage-card-{s} input[type='text']:not(.passcode-input)").count()

            print(f"  Stage {s}: {radio_count} radios, {checked_count} checked, {has_text_input} text inputs")
            if radio_count != 4 or checked_count != 0 or has_text_input != 0:
                print(f"  ❌ Stage {s} format mismatch! Expected 4 radios, 0 checked, 0 text inputs.")
                mcq_pass = False

        # Check Stage 5: only text input box
        st5_radios = page.locator("#stage-card-5 input[type='radio']").count()
        st5_text_box = page.locator("#stage5-answer").count()
        print(f"  Stage 5: {st5_radios} radios, {st5_text_box} text input (#stage5-answer)")

        st5_format_pass = (st5_radios == 0 and st5_text_box == 1)
        suite1_pass = mcq_pass and st5_format_pass
        results.append(("Question Formats (Stages 1-4 MCQ, Stage 5 Text Box)", suite1_pass))

        # ========================================================
        # TEST SUITE 2: ZERO-LEAK SPOILER CHECK (STAGE 5)
        # ========================================================
        print("\n" + "="*60)
        print("TEST SUITE 2: Zero-Leak Spoiler Check on Stage 5")
        print("="*60)

        # Switch to Stage 5 tab and unlock via passcode
        page.locator("#step-nav-5").click()
        time.sleep(0.3)
        page.locator("#passcode-5").fill("CTR1920")
        page.locator("#btn-unlock-stage-5").click()
        time.sleep(0.4)

        # Scan entire rendered DOM text of Stage 5 card on load
        stage5_text = (page.locator("#stage-card-5").inner_text() or "").lower()
        has_kala = "kala" in stage5_text
        has_leish = "leishmania" in stage5_text

        print(f"  Stage 5 text contains 'kala': {has_kala}")
        print(f"  Stage 5 text contains 'leishmania': {has_leish}")

        # Check #stage5-answer input value and placeholder
        st5_input = page.locator("#stage5-answer")
        val = st5_input.input_value()
        placeholder = st5_input.get_attribute("placeholder") or ""
        print(f"  #stage5-answer value: '{val}' (Expected '')")
        print(f"  #stage5-answer placeholder: '{placeholder}' (Expected 'Type disease name here...')")

        suite2_pass = (not has_kala and not has_leish and val == "" and placeholder == "Type disease name here...")
        results.append(("Zero-Leak Spoiler Check on Stage 5", suite2_pass))

        # ========================================================
        # TEST SUITE 3: TIME-BASED SCORING & SINGLE-ATTEMPT PENALTY
        # ========================================================
        print("\n" + "="*60)
        print("TEST SUITE 3: Time-Based Scoring & Single-Attempt Penalty")
        print("="*60)

        # Switch back to Stage 1
        page.locator("#step-nav-1").click()
        time.sleep(0.3)

        # Submit INCORRECT Option A on Stage 1
        page.locator("input[name='stage1-opt'][value='opt-a']").check()
        page.locator("#btn-submit-stage1").click()
        time.sleep(0.4)

        score_st1 = page.locator("#header-score").text_content()
        st1_disabled = page.locator("input[name='stage1-opt']").first.is_disabled()
        st1_btn_disabled = page.locator("#btn-submit-stage1").is_disabled()
        print(f"  Score after wrong answer on Stage 1: {score_st1} pts (Expected: 0)")
        print(f"  Stage 1 radios disabled: {st1_disabled}, Submit button disabled: {st1_btn_disabled}")

        # Reload page and verify lock and score 0 persist
        print("  Reloading page to verify single-attempt lock persistence...")
        page.reload()
        time.sleep(0.5)
        score_reload = page.locator("#header-score").text_content()
        st1_reload_disabled = page.locator("input[name='stage1-opt']").first.is_disabled()
        print(f"  Score after reload: {score_reload} pts (Expected: 0)")
        print(f"  Stage 1 radios still disabled: {st1_reload_disabled}")

        # Test Stage 2 Time Decay:
        # Unlock Stage 2
        page.locator("#step-nav-2").click()
        time.sleep(0.3)
        page.locator("#passcode-2").fill("LALBAGH1760")
        page.locator("#btn-unlock-stage-2").click()
        time.sleep(0.4)

        # Wait 10 seconds to test time decay (Points = max(200, 1000 - 10*10 = ~900))
        print("  Waiting 10 seconds on Stage 2 to verify dynamic time decay...")
        time.sleep(10.0)

        # Submit CORRECT Option C (Univ of Pittsburgh — ROSE Trial)
        page.locator("input[name='stage2-opt'][value='opt-c']").check()
        page.locator("#btn-submit-stage2").click()
        time.sleep(0.4)

        score_st2 = int(page.locator("#header-score").text_content())
        st2_disabled = page.locator("input[name='stage2-opt']").first.is_disabled()
        print(f"  Score awarded after ~10s on Stage 2: {score_st2} pts (Expected: 880 - 920 pts)")
        print(f"  Stage 2 locked immediately: {st2_disabled}")

        suite3_pass = (
            score_st1 == "0" and 
            st1_disabled and 
            st1_btn_disabled and 
            score_reload == "0" and 
            st1_reload_disabled and 
            880 <= score_st2 <= 920 and 
            st2_disabled
        )
        results.append(("Time-Based Scoring & Single-Attempt Penalty", suite3_pass))

        # ========================================================
        # TEST SUITE 4: KEYSTROKE COLLISION & INPUT ISOLATION
        # ========================================================
        print("\n" + "="*60)
        print("TEST SUITE 4: Keystroke Collision & Input Isolation")
        print("="*60)

        # Unlock Stage 5 and type in #stage5-answer with letters like F, C, L
        page.locator("#step-nav-5").click()
        time.sleep(0.3)

        test_string = "Dr. Raghavendra - Manipal Hospital Sarjapur Road"
        st5_input = page.locator("#stage5-answer")
        st5_input.click()
        st5_input.type(test_string, delay=15)

        typed_val = st5_input.input_value()
        print(f"  Typed value matched verbatim: {typed_val == test_string}")

        freeze_active = "active-freeze" in (page.locator("#btn-freeze-toggle").get_attribute("class") or "")
        print(f"  Freeze HUD was NOT triggered during typing: {not freeze_active}")

        suite4_pass = (typed_val == test_string and not freeze_active)
        results.append(("Keystroke Collision & Input Isolation", suite4_pass))

        # ========================================================
        # TEST SUITE 5: AUTO-UNLOCK TEST (?unlock=VIDHANA1956)
        # ========================================================
        print("\n" + "="*60)
        print("TEST SUITE 5: Auto-Unlock Test (?unlock=VIDHANA1956)")
        print("="*60)

        page.goto(f"http://localhost:{PORT}/?unlock=VIDHANA1956#hunt")
        time.sleep(0.6)

        st3_content_visible = page.locator("#stage3-content").is_visible()
        st3_locked_hidden = not page.locator("#stage3-locked").is_visible()
        pill_text = page.locator("#auto-unlock-pill").text_content()
        print(f"  Stage 3 Auto-Unlocked via URL: {st3_content_visible and st3_locked_hidden}")
        print(f"  Auto-Unlock Notification: '{pill_text}'")

        suite5_pass = (st3_content_visible and st3_locked_hidden)
        results.append(("Auto-Unlock via URL (?unlock=VIDHANA1956)", suite5_pass))

        # ========================================================
        # TEST SUITE 6: 100-DELEGATE LEADERBOARD STRESS TEST
        # ========================================================
        print("\n" + "="*60)
        print("TEST SUITE 6: 100-Delegate Auditorium Leaderboard Stress Test")
        print("="*60)

        page.goto(f"http://localhost:{PORT}/#leaderboard")
        page.wait_for_selector("#leaderboard-view")
        time.sleep(0.5)

        total_delegates = int(page.locator("#hud-total-delegates").text_content())
        print(f"  Total delegates in HUD: {total_delegates}")

        p1_name = page.locator("#podium-name-1").text_content()
        p1_score = int(page.locator("#podium-score-1").text_content())
        p2_name = page.locator("#podium-name-2").text_content()
        p2_score = int(page.locator("#podium-score-2").text_content())
        p3_name = page.locator("#podium-name-3").text_content()
        p3_score = int(page.locator("#podium-score-3").text_content())

        print(f"  🥇 Rank 1 Gold: {p1_name} ({p1_score} pts)")
        print(f"  🥈 Rank 2 Silver: {p2_name} ({p2_score} pts)")
        print(f"  🥉 Rank 3 Bronze: {p3_name} ({p3_score} pts)")

        sorted_correctly = (p1_score >= p2_score >= p3_score)
        print(f"  Podium scores strictly sorted (p1 >= p2 >= p3): {sorted_correctly}")

        row_count = page.locator("#ticker-viewport .ticker-row").count()
        print(f"  Auto-scroll ticker rows rendered: {row_count}")

        # Test Presenter 'F' Key (Freeze)
        page.keyboard.press("f")
        time.sleep(0.3)
        is_frozen = "active-freeze" in (page.locator("#btn-freeze-toggle").get_attribute("class") or "")
        print(f"  Presenter 'F' key froze ticker: {is_frozen}")

        page.keyboard.press("f")
        time.sleep(0.3)
        unfrozen = "active-freeze" not in (page.locator("#btn-freeze-toggle").get_attribute("class") or "")
        print(f"  Presenter 'F' key un-froze ticker: {unfrozen}")

        # Test Presenter 'C' Key (Confetti)
        page.keyboard.press("c")
        time.sleep(0.4)
        confetti_active = page.evaluate("() => { const c = document.getElementById('confetti-canvas'); return c && c.width > 0; }")
        print(f"  Presenter 'C' key triggered confetti: {confetti_active}")

        suite6_pass = (total_delegates >= 100 and sorted_correctly and row_count >= 90 and is_frozen and unfrozen and confetti_active)
        results.append(("100-Delegate Leaderboard Stress Test", suite6_pass))

        browser.close()

    # ========================================================
    # SUMMARY
    # ========================================================
    print("\n" + "="*60)
    print("FINAL TEST VERIFICATION SUMMARY")
    print("="*60)
    all_success = True
    for name, passed in results:
        status = "PASSED ✅" if passed else "FAILED ❌"
        print(f"  {name:55s} : {status}")
        if not passed:
            all_success = False

    print("="*60)
    if all_success:
        print("🎉 ALL TEST SUITES PASSED FLAWLESSLY (100% SUCCESS)!")
    else:
        print("⚠️ Some tests failed. Please review output above.")
    print("="*60)

    server.shutdown()
    sys.exit(0 if all_success else 1)

if __name__ == "__main__":
    run_tests()
