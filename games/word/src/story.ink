EXTERNAL remaining()
EXTERNAL flag(key)
EXTERNAL preview(key)
EXTERNAL refused_note()

-> opening

=== opening ===
Your uncle Nuri died last week. His shop is shut. Four people have come to decide whether it opens again.
He promised Halil morning repair work. He promised Rıza space for a delivery cart on the same floor. Both heard him clearly.
Osman owns the room. He leaves in twenty-four minutes to meet another tenant. Ferda has not decided whether to take the lease.
Nuri left a letter about a clothing order at the depot. Fetching it takes six minutes.
You have ₺100 (100 Turkish lira) for your journey home. You can spend it to make an agreement work.
* [Put the notebook on the table. (0 minutes)]
  @start
  -> END

=== table ===
Everyone must sign one agreement on work, storage and rent. Ask what they need and what they can change.
* [Hear what someone needs. (0 minutes)]
  @hear
  -> END
* {not flag("letter")} [Fetch Nuri’s letter. (6 minutes)]
  @letter
  -> END
* [Write an agreement.{flag("halil_left"): Call Halil back. (2 minutes)| (0 minutes)}]
  @offer
  -> END
* {not flag("caught")} [Speak to someone in private. (0 minutes)]
  @private
  -> END
* [Let Osman leave. End the meeting. (0 minutes)]
  @leave
  -> END

=== hear ===
A conversation takes two minutes. You can ask again after something changes.
* {not flag("halil_left")} [Ask Halil about the work. (2 minutes)]
  @ask_halil
  -> END
* {not flag("away")} [Ask Rıza about the cart. (2 minutes)]
  @ask_riza
  -> END
* [Ask Osman about rent. (2 minutes)]
  @ask_osman
  -> END
* [Ask Ferda about opening. (2 minutes)]
  @ask_ferda
  -> END
* [Return to the table. (0 minutes)]
  @back
  -> END

=== offer ===
Writing an agreement takes two minutes. Each signature takes one more minute.
An agreement’s terms can change after you ask people. Read the terms before writing. If you have not asked someone, their acceptance is unknown.
For a trial lease, ask Osman about rent before writing the agreement. After a conversation changes the terms, write a new agreement for everyone to sign.
{flag("caught"):Everyone now asks for a ₺40 deposit, because your private word proved false.}
* [Morning work. Rent an outside cart space. Full shop lease. (2 minutes){preview("morning")}]
  @morning
  -> END
* [Morning work. Smaller service and trial lease.{flag("riza"): Use Rıza’s yard.| Rent outside storage.} (2 minutes){preview("morning_small")}]
  @morning_small
  -> END
* {flag("letter")} [Late work. Use the clothing order. Full shop lease. (2 minutes){preview("late")}]
  @late
  -> END
* {flag("letter")} [Use the clothing order for a smaller late service and trial lease. (2 minutes){preview("late_small")}]
  @late_small
  -> END
* {not flag("letter")} [Suggest late work without the letter. (2 minutes){preview("late_unproved")}]
  @late_unproved
  -> END
* [Small repairs and cart inside, in marked spaces. Full shop lease. Ask both men to waive their guarantees. (2 minutes){preview("shared")}]
  @shared
  -> END
* [Small repairs and cart inside. Smaller service and trial lease. Ask both men to waive their guarantees. (2 minutes){preview("shared_small")}]
  @shared_small
  -> END
* [Return to the table. (0 minutes)]
  @back
  -> END

=== private ===
A private promise may persuade someone to waive a ₺40 guarantee for sharing the floor.
* {not flag("told_halil")} [Tell Halil: “The floor is reserved for morning work. Everyone agreed.” (2 minutes)]
  @tell_halil
  -> END
* {not flag("told_riza") && not flag("away")} [Tell Rıza: “The floor is not reserved for morning work. Everyone agreed.” (2 minutes)]
  @tell_riza
  -> END
* {flag("told_halil") || flag("told_riza")} [Withdraw your private word in writing. Add a ₺40 deposit. (2 minutes)]
  @disclose
  -> END
* [Return to the table. (0 minutes)]
  @back
  -> END

=== signing ===
The agreement stays on the table. Each person reads the same marked spaces, hours and price. Changing it cancels every signature.
* {not flag("waiting")} [Ask the next person to sign.{refused_note()} (1 minute)]
  @sign
  -> END
* {flag("waiting")} [Wait for Rıza to return. ({remaining() - 10} {remaining() == 11:minute|minutes})]
  @wait
  -> END
* {flag("can_leave")} [Let Halil return to his workshop with his signed agreement. (0 minutes)]
  @release_halil
  -> END
* [Hear what someone needs. (0 minutes)]
  @hear
  -> END
* [Change the agreement. Clear every signature.{flag("halil_left"): Call Halil back. (2 minutes)| (0 minutes)}]
  @offer
  -> END
* [End the meeting without agreement. (0 minutes)]
  @leave
  -> END

=== ending ===
* [Close the notebook. (0 minutes)]
  @close
  -> END
